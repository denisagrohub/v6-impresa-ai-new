# pylint: disable=import-error
"""Admin Todos API — CRUD erpv6.todo (C1a-2a).

Endpoint per la dashboard admin: lista TODO (scope mine|all), crea,
aggiorna, elimina.

Regole:
- GET scope=mine → i propri TODO (default).
- GET scope=all  → tutti (solo admin, altrimenti 403).
- POST → user_id = utente corrente (mai passabile dal client).
- PATCH → solo proprietario o admin.
- DELETE → solo admin (group_system).

Riusa _authenticate + _is_admin_or_chief di APIBaseController.
"""
import json
import logging

from odoo import fields, http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminTodosAPIController(ConsultantAPIController):

    def _todo_to_dict(self, t):
        """Serializza un TODO con i nomi risolti (no fetch extra client)."""
        today = fields.Date.today()
        is_overdue = bool(
            t.state == 'open'
            and t.due_date
            and t.due_date < today
        )
        return {
            'id': t.id,
            'name': t.name or '',
            'description': t.description or '',
            'user_id': t.user_id.id if t.user_id else None,
            'user_name': t.user_id.name if t.user_id else None,
            'project_id': t.project_id.id if t.project_id else None,
            'project_name': t.project_id.name if t.project_id else None,
            'deal_id': t.deal_id.id if t.deal_id else None,
            'deal_name': t.deal_id.name if t.deal_id else None,
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'state': t.state,
            'is_auto': t.is_auto,
            'source': t.source or None,
            'done_at': self._iso_utc(t.done_at) if t.done_at else None,
            'create_date': self._iso_utc(t.create_date) if t.create_date else None,
            'is_overdue': is_overdue,
        }

    def _is_strict_admin(self, user):
        """Admin stretto (group_system), per azioni riservate."""
        return user.has_group('base.group_system')

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/todos
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/todos', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def list_todos(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        args = request.httprequest.args
        scope = (args.get('scope') or 'mine').strip().lower()
        state_filter = (args.get('state') or '').strip()
        project_id = args.get('project_id')
        deal_id = args.get('deal_id')
        try:
            limit = int(args.get('limit') or 50)
        except (ValueError, TypeError):
            limit = 50

        is_admin = self._is_strict_admin(user)

        if scope == 'all' and not is_admin:
            return self._json_response(
                {'error': 'Scope "all" riservato agli amministratori'}, 403)

        domain = []
        if scope == 'mine':
            domain.append(('user_id', '=', user.id))
        # scope == 'all' → nessun filtro user_id

        if state_filter in ('open', 'done', 'cancelled'):
            domain.append(('state', '=', state_filter))
        if project_id:
            try:
                domain.append(('project_id', '=', int(project_id)))
            except (ValueError, TypeError):
                pass
        if deal_id:
            try:
                domain.append(('deal_id', '=', int(deal_id)))
            except (ValueError, TypeError):
                pass

        Todo = request.env['erpv6.todo'].sudo()
        todos = Todo.search(domain, limit=limit, order='state, due_date asc, create_date desc')
        total = Todo.search_count(domain)

        return self._json_response({
            'todos': [self._todo_to_dict(t) for t in todos],
            'total': total,
            'scope': scope,
            'is_admin': is_admin,
        })

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/todos/counts — contatori per badge sidebar
    # 02/10/2026 (C1a-5): open / overdue / today / done_today
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/todos/counts', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def counts_todos(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        args = request.httprequest.args
        scope = (args.get('scope') or 'mine').strip().lower()
        is_admin = self._is_strict_admin(user)

        if scope == 'all' and not is_admin:
            return self._json_response(
                {'error': 'Scope "all" riservato agli amministratori'}, 403)

        domain = []
        if scope == 'mine':
            domain.append(('user_id', '=', user.id))

        Todo = request.env['erpv6.todo'].sudo()
        today = fields.Date.today()

        def count(extra):
            return Todo.search_count(domain + extra)

        overdue = count([('state', '=', 'open'), ('due_date', '<', today)])
        open_count = count([('state', '=', 'open')])
        today_count = count([('state', '=', 'open'), ('due_date', '=', today)])
        # done_today: done con done_at >= inizio giornata
        from datetime import datetime, time as _time
        today_start = datetime.combine(today, _time.min)
        done_today = count([
            ('state', '=', 'done'),
            ('done_at', '>=', today_start.strftime('%Y-%m-%d %H:%M:%S')),
        ])

        return self._json_response({
            'open': open_count,
            'overdue': overdue,
            'today': today_count,
            'done_today': done_today,
            'scope': scope,
        })

    # ═══════════════════════════════════════════════════════════════
    # POST /api/v1/admin/todos
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/todos', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def create_todo(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)

        name = (body.get('name') or '').strip()
        if not name:
            return self._json_response({'error': 'Il campo "name" è obbligatorio'}, 400)

        # 02/10/2026 (C1a-3): admin può assegnare a un altro utente.
        # Non-admin: user_id = user.id (invariato).
        is_admin = self._is_strict_admin(user)
        target_user_id = user.id
        if is_admin and body.get('user_id'):
            try:
                target_user_id = int(body['user_id'])
            except (ValueError, TypeError):
                return self._json_response({'error': 'user_id non valido'}, 400)
            target = request.env['res.users'].sudo().browse(target_user_id)
            if not target.exists() or not target.active:
                return self._json_response(
                    {'error': 'Utente non trovato o disattivato'}, 400)

        vals = {
            'name': name,
            'description': body.get('description') or '',
            'user_id': target_user_id,
            'state': 'open',
            'is_auto': False,
        }

        # Opzionali con null-handling
        if body.get('project_id'):
            try:
                vals['project_id'] = int(body['project_id'])
            except (ValueError, TypeError):
                return self._json_response({'error': 'project_id non valido'}, 400)
        if body.get('deal_id'):
            try:
                vals['deal_id'] = int(body['deal_id'])
            except (ValueError, TypeError):
                return self._json_response({'error': 'deal_id non valido'}, 400)
        if body.get('due_date'):
            vals['due_date'] = body['due_date']

        try:
            todo = request.env['erpv6.todo'].sudo().create(vals)
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore creazione TODO')
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({'todo': self._todo_to_dict(todo)})

    # ═══════════════════════════════════════════════════════════════
    # PATCH /api/v1/admin/todos/<int:todo_id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/todos/<int:todo_id>', type='http', auth='none',
                methods=['PATCH', 'PUT', 'OPTIONS'], csrf=False)
    def update_todo(self, todo_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        Todo = request.env['erpv6.todo'].sudo()
        todo = Todo.browse(todo_id)
        if not todo.exists():
            return self._json_response({'error': 'TODO non trovato'}, 404)

        is_admin = self._is_strict_admin(user)
        if todo.user_id.id != user.id and not is_admin:
            return self._json_response(
                {'error': 'Puoi modificare solo i tuoi TODO'}, 403)

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)

        vals = {}
        if 'name' in body:
            n = (body.get('name') or '').strip()
            if not n:
                return self._json_response({'error': 'Il campo "name" non può essere vuoto'}, 400)
            vals['name'] = n
        if 'description' in body:
            vals['description'] = body.get('description') or ''
        if 'due_date' in body:
            vals['due_date'] = body.get('due_date') or False
        # 02/10/2026 (C1a-3): solo admin può riassegnare a un altro utente.
        if 'user_id' in body and is_admin:
            try:
                uid = int(body['user_id'])
            except (ValueError, TypeError):
                return self._json_response({'error': 'user_id non valido'}, 400)
            target = request.env['res.users'].sudo().browse(uid)
            if not target.exists() or not target.active:
                return self._json_response(
                    {'error': 'Utente non trovato o disattivato'}, 400)
            vals['user_id'] = uid
        if 'state' in body:
            st = body.get('state')
            if st not in ('open', 'done', 'cancelled'):
                return self._json_response(
                    {'error': 'state deve essere open|done|cancelled'}, 400)
            vals['state'] = st

        if not vals:
            return self._json_response({'error': 'Nessun campo da aggiornare'}, 400)

        try:
            todo.write(vals)
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore update TODO %s', todo_id)
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({'todo': self._todo_to_dict(todo)})

    # ═══════════════════════════════════════════════════════════════
    # DELETE /api/v1/admin/todos/<int:todo_id> — solo admin
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/todos/<int:todo_id>', type='http', auth='none',
                methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_todo(self, todo_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        if not self._is_strict_admin(user):
            return self._json_response(
                {'error': 'Eliminazione riservata agli amministratori'}, 403)

        Todo = request.env['erpv6.todo'].sudo()
        todo = Todo.browse(todo_id)
        if not todo.exists():
            return self._json_response({'error': 'TODO non trovato'}, 404)

        try:
            todo.unlink()
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore unlink TODO %s', todo_id)
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({'deleted': True, 'id': todo_id})
