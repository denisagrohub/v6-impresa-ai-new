# pylint: disable=import-error
"""Consultant API Controller - dati reali per la dashboard consulente
(apps/impresa/src/app/consultant/dashboard/page.tsx), Denis 25/08/2026.

erpv6_api_gateway resta agnostico da erpv6_production (stesso pattern
hasattr/"in env" gia' usato in interview_api.py/lead_api.py): se il modulo
non e' installato, gli endpoint rispondono 501 invece di crashare.

Ruoli (stesso schema di /api/v1/auth/login in main.py): Responsabile
(sales_team.group_sale_manager) e Admin (base.group_system) vedono/possono
tutto; un Consulente (erpv6_core.group_consulente) vede/puo' agire solo sul
proprio - il filtro sui DATI resta comunque garantito anche qui esplicitamente
(mai fidarsi solo del frontend che nasconde un bottone)."""
import json
import logging
import time

from odoo import http, SUPERUSER_ID
from markupsafe import Markup
from odoo.exceptions import UserError
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


from .consultant_api import ConsultantAPIController


class ConsultantProjectsAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/projects', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_projects(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.production.order' not in env:
            return self._not_installed('/api/v1/consultant/projects', start_time)

        is_admin = self._is_responsabile_o_admin(user)
        show_all = is_admin and kwargs.get('all') in ('1', 'true', 'True')
        domain = [] if show_all else [('lead_id.user_id', '=', user.id)]

        Order = env['erpv6.production.order'].sudo()
        orders = Order.search(domain, order='create_date desc')

        def role_labels(lead):
            mine = lead.consulente_line_ids.filtered(lambda l: l.user_id.id == user.id)
            return [dict(l._fields['role'].selection).get(l.role) for l in mine]

        projects = []
        for order in orders:
            lead = order.lead_id
            projects.append({
                'id': order.id,
                'lead_id': lead.id,
                'name': lead.name or order.name,
                'client': lead.partner_name or lead.contact_name or '',
                'phase': order.phase_id.name or '',
                'verticale': order.verticale or '',
                'package_hint': order.interview_package_hint or '',
                'lead_type': lead.type,
                'consulente': lead.user_id.name if lead.user_id else '',
                'consulente_id': lead.user_id.id if lead.user_id else None,
                'ruoli_miei': role_labels(lead),
                'create_date': order.create_date.isoformat() if order.create_date else None,
            })

        # Lead gia' sourced dal consulente (o comunque suoi) ma senza
        # ancora una erpv6.production.order (es. intervista dalla dashboard
        # avviata ma non ancora completata, vedi _start_production) - non
        # vanno nascosti silenziosamente, sono comunque un "progetto" reale
        # in corso agli occhi del consulente, solo non ancora arrivato in
        # produzione.
        Lead = env['crm.lead'].sudo()
        lead_domain = [] if show_all else [('user_id', '=', user.id)]
        leads_without_order = Lead.search(lead_domain + [('id', 'not in', orders.mapped('lead_id').ids)],
                                           order='create_date desc')
        leads_pending = [{
            'id': lead.id,
            'name': lead.name,
            'client': lead.partner_name or lead.contact_name or '',
            'type': lead.type,
            'consulente': lead.user_id.name if lead.user_id else '',
            'ruoli_miei': role_labels(lead),
            'create_date': lead.create_date.isoformat() if lead.create_date else None,
        } for lead in leads_without_order]

        self._log_api_call('/api/v1/consultant/projects', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'showing_all': show_all,
            'orders': projects,
            'leads_senza_produzione': leads_pending,
        })

    # ------------------------------------------------------------------
    # Tab "Richieste": erpv6.consulente.richiesta - un Consulente vede/crea
    # solo le proprie, un Responsabile/Admin vede tutte (default) e puo'
    # approvare/rifiutare (azione in piu' riservata al suo ruolo).
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/projects/<int:relation_id>/playbook', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_project_playbook(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Relation = env['erpv6.tracking.relation'].sudo()
        root = Relation.browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            in_access = user.id in (root.access_user_ids.ids or [])
            is_owner = root.owner_user_id.id == user.id
            in_split = False
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
                in_split = any(
                    b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                    for b in (split.get('beneficiari') or []))
            except Exception:
                pass
            if not (is_owner or in_access or in_split):
                return self._json_response({'error': 'Non hai accesso'}, 403)

        charter = None
        try: charter = json.loads(root.x_v6_charter or '{}') if root.x_v6_charter else None
        except Exception: pass
        scouting = None
        try: scouting = json.loads(root.x_v6_scouting or '{}') if root.x_v6_scouting else None
        except Exception: pass

        targets = root.child_ids.filtered(lambda c: c.funzione_progetto == 'target')
        targets_data = []
        for t in targets:
            p = t.partner_id
            c = t.contatto_principale_id
            targets_data.append({
                'id': t.id, 'name': t.name,
                'partner_name': p.name if p else None,
                'partner_email': p.email if p else None,
                'partner_phone': p.phone if p else None,
                'contatto_name': c.name if c else None,
                'stage_name': t.stage_id.name if t.stage_id else None,
                'state': t.state,
            })

        return self._json_response({
            'id': root.id,
            'name': root.name,
            'email_alias': root.email_alias or '',
            'phase': root.state,
            'charter': charter,
            'scouting': scouting,
            'targets': targets_data,
            'target_count': len(targets_data),
        })

    # ------------------------------------------------------------------
    # Split V6 personale (23/09/2026): dettaglio + accetta/rifiuta.
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/projects/<int:relation_id>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_project_detail(self, relation_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        Relation = env['erpv6.tracking.relation'].sudo()
        root = Relation.browse(relation_id)
        if not root.exists():
            self._log_api_call('/api/v1/consultant/projects/detail', 'GET', user.id, 404, start_time)
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            # Verifica accesso
            is_owner = root.owner_user_id.id == user.id
            in_access = user.id in (root.access_user_ids.ids or [])
            in_split = False
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
                in_split = any(
                    b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                    for b in (split.get('beneficiari') or [])
                )
            except (json.JSONDecodeError, TypeError):
                pass

            if not (is_owner or in_access or in_split):
                self._log_api_call('/api/v1/consultant/projects/detail', 'GET', user.id, 403, start_time)
                return self._json_response({'error': 'Non hai accesso a questo progetto'}, 403)

        # Target figli (funzione=target)
        targets = root.child_ids.filtered(lambda c: c.funzione_progetto == 'target')
        targets_data = [{
            'id': t.id,
            'name': t.name,
            'partner_id': t.partner_id.id if t.partner_id else None,
            'partner_name': t.partner_id.name if t.partner_id else '',
            'contatto_id': t.contatto_principale_id.id if t.contatto_principale_id else None,
            'contatto_name': t.contatto_principale_id.name if t.contatto_principale_id else '',
            'stage_id': t.stage_id.id if t.stage_id else None,
            'stage_name': t.stage_id.name if t.stage_id else '',
            'state': t.state,
        } for t in targets]

        # 21/09/2026: email del progetto - shared inbox, il consulente
        # vede TUTTE le email del progetto (non solo quelle a lui indirizzate).
        email_domain = [('relation_id', '=', root.id)]
        emails = env['erpv6.winwin.email.log'].sudo().search(email_domain, order='create_date desc', limit=50) \
            if 'erpv6.winwin.email.log' in env else []
        emails_data = [{
            'id': e.id,
            'subject': e.name,
            'sender_email': e.sender_email or '',
            'recipient_user_id': e.recipient_user_id.id if e.recipient_user_id else None,
            'create_date': e.create_date.isoformat() if e.create_date else None,
        } for e in emails]

        # Mio compenso (se presente nello split)
        mio_compenso = None
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
            base = split.get('base') or {}
            mine = next(
                (b for b in (split.get('beneficiari') or [])
                 if b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'),
                None,
            )
            if mine:
                mio_compenso = {
                    'pct': float(mine.get('pct') or 0),
                    'base_tipo': base.get('tipo'),
                    'base_valore': float(base.get('valore') or 0),
                    'base_unita': base.get('unita') or '',
                    'approvato': bool(root.revenue_split_approved),
                }
        except (json.JSONDecodeError, TypeError):
            pass

        self._log_api_call('/api/v1/consultant/projects/detail', 'GET', user.id, 200, start_time)
        return self._json_response({
            'id': root.id,
            'name': root.name,
            'is_admin': is_admin,
            'project_phase': root.state,
            'targets': targets_data,
            'emails': emails_data,
            'mio_compenso': mio_compenso,
        })

    # ------------------------------------------------------------------
    # Tab "Progetti Partner" (21/09/2026): nodi erpv6.tracking.relation
    # radice (parent_id=False) dove il consulente e' owner_user_id,
    # in access_user_ids, o compare come beneficiario tipo='consulente'
    # nello split V6. Distinto da /consultant/projects (che mostra solo
    # production order / crm.lead di consulenza).
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/partner-projects', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_partner_projects(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.tracking.relation' not in env:
            self._log_api_call('/api/v1/consultant/partner-projects', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'aeosv6_relation non installato'}, 501)

        is_admin = self._is_responsabile_o_admin(user)
        Relation = env['erpv6.tracking.relation'].sudo()

        # Base: tutti i root con split configurato (per admin)
        # o con accesso specifico (per consulente)
        domain = [('parent_id', '=', False)]

        candidates = Relation.search(domain, order='name asc')

        result = []
        for root in candidates:
            # Verifica accesso per consulente
            if not is_admin:
                is_owner = root.owner_user_id.id == user.id
                in_access = user.id in (root.access_user_ids.ids or [])
                in_split = False
                try:
                    split = json.loads(root.x_v6_revenue_split or '{}')
                    in_split = any(
                        b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                        for b in (split.get('beneficiari') or [])
                    )
                except (json.JSONDecodeError, TypeError):
                    pass
                if not (is_owner or in_access or in_split):
                    continue

            # Conta i target figli
            targets_count = len(root.child_ids.filtered(lambda c: c.funzione_progetto == 'target'))

            result.append({
                'id': root.id,
                'name': root.name,
                'state': root.state or 'attivo',
                'targets_count': targets_count,
                'email_alias': root.email_alias or '',
                'owner_name': root.owner_user_id.name if root.owner_user_id else '',
                'has_split': bool(root.x_v6_revenue_split),
                'split_approvato': bool(root.revenue_split_approved),
            })

        self._log_api_call('/api/v1/consultant/partner-projects', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'count': len(result),
            'projects': result,
        })

    # ------------------------------------------------------------------
    # Dettaglio email (21/09/2026): ritorna il corpo dell'email leggendo
    # il mail.message collegato a erpv6.winwin.email.log (via mail.thread).
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # DELETE email: rimuove il log e i mail.message collegati.
    # Solo admin/responsabile oppure il recipient_user_id.
    # (21/09/2026)
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Email non lette: conteggio + mark-read. (22/09/2026)
    # Solo email 'ricevuta' con is_read=False per l'utente loggato.
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/targets/<int:target_id>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_target_detail(self, target_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.tracking.relation' not in env:
            return self._json_response({'error': 'Modulo non installato'}, 501)

        Target = env['erpv6.tracking.relation'].sudo()
        target = Target.browse(target_id)
        if not target.exists():
            return self._json_response({'error': 'Target non trovato'}, 404)

        if not target.parent_id or target.funzione_progetto != 'target':
            return self._json_response({'error': 'Nodo non è un target'}, 400)

        root = target.parent_id
        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            is_owner = root.owner_user_id.id == user.id
            in_access = user.id in root.access_user_ids.ids
            in_split = False
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
                in_split = any(
                    b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                    for b in (split.get('beneficiari') or [])
                )
            except (json.JSONDecodeError, TypeError):
                pass
            if not (is_owner or in_access or in_split):
                return self._json_response({'error': 'Non hai accesso a questo target'}, 403)

        partner = target.partner_id
        contatto = target.contatto_principale_id

        dossier = None
        if target.x_v6_dossier:
            try:
                dossier = json.loads(target.x_v6_dossier)
            except (json.JSONDecodeError, TypeError):
                pass

        # Email del target (relation_id = target.id)
        emails_data = []
        if 'erpv6.winwin.email.log' in env:
            emails = env['erpv6.winwin.email.log'].sudo().search([
                ('relation_id', '=', target.id)
            ], order='create_date desc', limit=30)
            emails_data = [{
                'id': e.id,
                'subject': e.name,
                'sender_email': e.sender_email or '',
                'direction': e.direction or 'ricevuta',
            'is_read': bool(e.is_read),
            'is_archived': bool(e.is_archived),
            'has_attachments': bool(env['ir.attachment'].sudo().search_count([('res_model', '=', 'erpv6.winwin.email.log'), ('res_id', '=', e.id)])),
                'create_date': e.create_date.isoformat() if e.create_date else None,
            } for e in emails]

        # Call del target
        calls_data = []
        if 'erpv6.call.log' in env:
            calls = env['erpv6.call.log'].sudo().search([
                ('relation_id', '=', target.id)
            ], order='started_at desc', limit=10)
            calls_data = [{
                'id': c.id,
                'started_at': c.started_at.isoformat() if c.started_at else None,
                'duration_minutes': c.duration_minutes or 0,
                'state': c.state,
            } for c in calls]

        self._log_api_call('/api/v1/consultant/targets/detail', 'GET', user.id, 200, start_time)
        return self._json_response({
            'id': target.id,
            'name': target.name,
            'root_id': root.id,
            'root_name': root.name,
            'stage_name': target.stage_id.name if target.stage_id else '',
            'state': target.state or 'attivo',
            'funzione': target.funzione_progetto,
            'partner': {
                'id': partner.id, 'name': partner.name or '',
                'email': partner.email or '', 'phone': partner.phone or '',
            } if partner else None,
            'contatto': {
                'id': contatto.id, 'name': contatto.name or '',
                'email': contatto.email or '', 'phone': contatto.phone or '',
            } if contatto else None,
            'dossier': dossier,
            'emails': emails_data,
            'calls': calls_data,
        })

