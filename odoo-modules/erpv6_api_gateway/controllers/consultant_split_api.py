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

from odoo import http, fields, SUPERUSER_ID
from markupsafe import Markup
from odoo.exceptions import UserError
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


from .consultant_api import ConsultantAPIController


class ConsultantSplitAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/projects/<int:relation_id>/my-split', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_my_split(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        root = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
        except (json.JSONDecodeError, TypeError):
            split = {}
        beneficiari = split.get('beneficiari') or []
        base = split.get('base') or {}
        mine = next((b for b in beneficiari if b.get('res_partner_id') == user.partner_id.id), None)
        if not mine:
            return self._json_response({'has_split': False})
        # has_fiscal_data?
        p = user.partner_id
        has_fiscal = bool(p.l10n_it_codice_fiscale and p.street and p.city and p.zip)
        return self._json_response({
            'has_split': True,
            'pct': float(mine.get('pct') or 0),
            'base_tipo': base.get('tipo'),
            'base_valore': float(base.get('valore') or 0),
            'base_unita': base.get('unita') or '',
            'approved': bool(root.revenue_split_approved),
            'accepted_at': root.revenue_split_accepted_at.isoformat() if root.revenue_split_accepted_at else None,
            'accepted_by_name': root.revenue_split_accepted_by.name if root.revenue_split_accepted_by else None,
            'rejected_reason': root.revenue_split_rejected_reason or None,
            'rejected_at': root.revenue_split_rejected_at.isoformat() if root.revenue_split_rejected_at else None,
            'notified_at': root.revenue_split_notified_at.isoformat() if root.revenue_split_notified_at else None,
            'has_fiscal_data': has_fiscal,
        })

    @http.route('/api/v1/consultant/projects/<int:relation_id>/accept-split', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_accept_split(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        root = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
        except (json.JSONDecodeError, TypeError):
            split = {}
        mine = next(
            (b for b in (split.get('beneficiari') or []) if b.get('res_partner_id') == user.partner_id.id),
            None,
        )
        if not mine:
            return self._json_response({'error': 'Non sei nello split di questo progetto'}, 403)
        root.write({
            'revenue_split_accepted_at': fields.Datetime.now(),
            'revenue_split_accepted_by': user.id,
            'revenue_split_rejected_reason': False,
            'revenue_split_rejected_at': False,
        })
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/projects/<int:relation_id>/reject-split', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_reject_split(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        try:
            data = json.loads(request.httprequest.get_data() or b'{}')
        except json.JSONDecodeError:
            data = {}
        reason = (data.get('reason') or '').strip()
        if not reason:
            return self._json_response({'error': 'Il motivo del rifiuto è obbligatorio'}, 400)
        env = request.env
        root = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
        except (json.JSONDecodeError, TypeError):
            split = {}
        mine = next(
            (b for b in (split.get('beneficiari') or []) if b.get('res_partner_id') == user.partner_id.id),
            None,
        )
        if not mine:
            return self._json_response({'error': 'Non sei nello split'}, 403)
        root.write({
            'revenue_split_rejected_reason': reason,
            'revenue_split_rejected_at': fields.Datetime.now(),
            'revenue_split_accepted_at': False,
            'revenue_split_accepted_by': False,
            'revenue_split_state': 'rifiutato',
        })

        # notifica admin (Denis) con motivazione
        try:
            admin = env.ref('base.user_admin', raise_if_not_found=False)
            if admin and admin.partner_id:
                server = env['ir.mail_server'].sudo().search(
                    [('from_filter', '=', 'v6sviluppoimpresa.it')], limit=1)
                ctx = root.with_context(
                    mail_server_id=server.id if server else False,
                    email_from='V6impresa Sistema <sistema@v6sviluppoimpresa.it>',
                )
                ctx.message_notify(
                    partner_ids=[admin.partner_id.id],
                    subject=f'[Rifiuto] Split {root.name} rifiutato da {user.name}',
                    body=(
                        f'<p><b>{user.name}</b> ha <b>rifiutato</b> lo split del progetto <b>{root.name}</b>.</p>'
                        f'<p><b>Motivazione:</b></p>'
                        f'<blockquote style="border-left:3px solid #ccc;padding-left:10px;color:#444;">'
                        f'{reason}</blockquote>'
                        f'<p>Puoi ora modificare lo split e rimandarlo in firma.</p>'
                    ),
                    subtype_xmlid='mail.mt_comment',
                )
        except Exception:
            _logger.exception('Notifica rifiuto ad admin fallita')

        return self._json_response({'success': True})

    # ------------------------------------------------------------------
    # Dati fiscali consulente (23/09/2026): form dashboard.
    # ------------------------------------------------------------------

