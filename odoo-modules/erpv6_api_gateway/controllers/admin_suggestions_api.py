# pylint: disable=import-error
"""Admin Suggestions API — C1b.

Endpoint:
- GET  /api/v1/admin/suggestions?scope=mine|all&state=new,shown
- POST /api/v1/admin/suggestions/<id>/accept
- POST /api/v1/admin/suggestions/<id>/ignore
- POST /api/v1/admin/suggestions/scan       (admin only, per test)
- POST /api/v1/admin/suggestions/show       (batch: marca shown le new visibili)
"""
import logging

from odoo import fields, http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminSuggestionsAPIController(ConsultantAPIController):

    def _suggestion_to_dict(self, s):
        return {
            'id': s.id,
            'rule_code': s.rule_code,
            'title': s.title or '',
            'body': s.body or '',
            'priority': s.priority,
            'state': s.state,
            'relation_id': s.relation_id.id if s.relation_id else None,
            'relation_name': s.relation_id.name if s.relation_id else None,
            'deal_id': s.deal_id.id if s.deal_id else None,
            'deal_name': s.deal_id.name if s.deal_id else None,
            'user_id': s.user_id.id,
            'user_name': s.user_id.name,
            'created_date': self._iso_utc(s.create_date) if s.create_date else None,
            'shown_at': self._iso_utc(s.shown_at) if s.shown_at else None,
            'decided_at': self._iso_utc(s.decided_at) if s.decided_at else None,
            'ignore_count': s.ignore_count,
        }

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/suggestions
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/suggestions', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def list_suggestions(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        args = request.httprequest.args
        scope = (args.get('scope') or 'mine').strip().lower()
        states_csv = (args.get('state') or '').strip()
        is_admin = self._is_strict_admin(user)

        if scope == 'all' and not is_admin:
            return self._json_response(
                {'error': 'Scope "all" riservato agli admin'}, 403)

        domain = []
        if scope == 'mine':
            domain.append(('user_id', '=', user.id))
        if states_csv:
            states = [x.strip() for x in states_csv.split(',') if x.strip()]
            if states:
                domain.append(('state', 'in', states))
        else:
            domain.append(('state', 'in', ('new', 'shown')))

        S = request.env['erpv6.suggestion'].sudo()
        suggestions = S.search(domain, order='priority desc, create_date desc', limit=50)
        return self._json_response({
            'suggestions': [self._suggestion_to_dict(s) for s in suggestions],
            'total': len(suggestions),
            'daily_cap': 5,
            'scope': scope,
            'is_admin': is_admin,
        })

    # ═══════════════════════════════════════════════════════════════
    # POST /<id>/accept
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/suggestions/<int:sid>/accept', type='http',
                auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def accept_suggestion(self, sid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        S = request.env['erpv6.suggestion'].sudo()
        s = S.browse(sid)
        if not s.exists():
            return self._json_response({'error': 'not found'}, 404)
        is_admin = self._is_strict_admin(user)
        if s.user_id.id != user.id and not is_admin:
            return self._json_response({'error': 'Non tuo'}, 403)
        # 03/10/2026 (C1b-bot-2): action_accept centralizzato, crea TODO
        todo = s.action_accept()
        request.env.cr.commit()
        return self._json_response({
            'success': True,
            'id': sid,
            'suggestion': self._suggestion_to_dict(s),
            'todo_created': {
                'id': todo.id,
                'name': todo.name,
                'due_date': str(todo.due_date) if todo.due_date else None,
                'source': todo.source,
            } if todo else None,
        })

    # ═══════════════════════════════════════════════════════════════
    # POST /<id>/ignore
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/suggestions/<int:sid>/ignore', type='http',
                auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def ignore_suggestion(self, sid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        S = request.env['erpv6.suggestion'].sudo()
        s = S.browse(sid)
        if not s.exists():
            return self._json_response({'error': 'not found'}, 404)
        is_admin = self._is_strict_admin(user)
        if s.user_id.id != user.id and not is_admin:
            return self._json_response({'error': 'Non tuo'}, 403)
        s.action_ignore()
        request.env.cr.commit()
        return self._json_response({'success': True, 'ignore_count': s.ignore_count})

    # ═══════════════════════════════════════════════════════════════
    # POST /scan — admin only, per test manuale
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/suggestions/scan', type='http',
                auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def scan_suggestions(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_strict_admin(user):
            return self._json_response({'error': 'Solo admin'}, 403)
        S = request.env['erpv6.suggestion'].sudo()
        n = S._scan_and_generate()
        request.env.cr.commit()
        return self._json_response({'success': True, 'created': n})

    # ═══════════════════════════════════════════════════════════════
    # POST /show — marca come 'shown' le new visibili
    # ═══════════════════════════════════════════════════════════════
    # ═══════════════════════════════════════════════════════════════
    # POST /<id>/notify-telegram — admin only, bypassa rate limit
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/suggestions/<int:sid>/notify-telegram',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def notify_telegram(self, sid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_strict_admin(user):
            return self._json_response({'error': 'Solo admin'}, 403)

        S = request.env['erpv6.suggestion'].sudo()
        suggestion = S.browse(sid)
        if not suggestion.exists():
            return self._json_response({'error': 'Suggestion non trovata'}, 404)
        if not suggestion.user_id.telegram_chat_id:
            return self._json_response({
                'sent': False,
                'reason': 'User senza telegram_chat_id',
            })
        rule = suggestion._get_rule()
        if not rule.message_template:
            return self._json_response({
                'sent': False,
                'reason': 'Rule senza message_template',
            })

        text, markup = suggestion._build_single_message(
            suggestion, suggestion.user_id)
        if not text:
            return self._json_response({
                'sent': False,
                'reason': 'Template vuoto',
            })

        Config = request.env['erpv6.agent.telegram.config'].sudo()
        config = Config.search([('is_active', '=', True)], limit=1)
        if not config:
            return self._json_response({
                'sent': False,
                'reason': 'Nessuna config Telegram attiva',
            })

        try:
            ok = config.send_message(
                text=text,
                reply_markup=markup,
                chat_id_override=suggestion.user_id.telegram_chat_id,
            )
            if ok:
                suggestion.notified_telegram_at = fields.Datetime.now()
                request.env.cr.commit()
                return self._json_response({'sent': True})
            return self._json_response({
                'sent': False,
                'reason': 'send_message ha ritornato False (vedi log Odoo)',
            })
        except Exception as e:
            _logger.exception('notify_telegram fallito')
            return self._json_response({'sent': False, 'reason': str(e)}, 500)

    @http.route('/api/v1/admin/suggestions/show', type='http',
                auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def show_suggestions(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        S = request.env['erpv6.suggestion'].sudo()
        mine = S.search([('user_id', '=', user.id), ('state', '=', 'new')])
        mine.action_show()
        request.env.cr.commit()
        return self._json_response({'success': True, 'marked': len(mine)})
