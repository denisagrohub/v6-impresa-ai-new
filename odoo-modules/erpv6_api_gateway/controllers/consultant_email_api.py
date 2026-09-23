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


class ConsultantEmailAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/emails', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_emails(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            self._log_api_call('/api/v1/consultant/emails', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'erpv6_winwin_renderdata non installato'}, 501)

        is_admin = self._is_responsabile_o_admin(user)
        show_all = is_admin and kwargs.get('all') in ('1', 'true', 'True')

        domain = [] if show_all else [('recipient_user_id', '=', user.id)]
        # 22/09/2026: escludi archiviate (o mostra solo archiviate con ?archived=1)
        if kwargs.get('archived') in ('1','true','True'):
            domain.append(('is_archived', '=', True))
        else:
            domain.append(('is_archived', '=', False))
        # opzionale filtro per progetto
        relation_id = kwargs.get('relation_id')
        if relation_id:
            try:
                domain.append(('relation_id', '=', int(relation_id)))
            except (ValueError, TypeError):
                pass

        limit = min(int(kwargs.get('limit') or 50), 200)
        Log = env['erpv6.winwin.email.log'].sudo()
        logs = Log.search(domain, order='create_date desc', limit=limit)

        emails = [{
            'id': l.id,
            'subject': l.name or '(senza oggetto)',
            'sender_email': l.sender_email or '',
            'recipient_emails': l.recipient_emails or '',
            'cc_emails': l.cc_emails or '',
            'match_status': l.match_status,
            'matched_alias': l.matched_alias or '',
            'relation_id': l.relation_id.id if l.relation_id else None,
            'relation_name': l.relation_id.name if l.relation_id else None,
            'recipient_user_id': l.recipient_user_id.id if l.recipient_user_id else None,
            'recipient_user_name': l.recipient_user_id.name if l.recipient_user_id else None,
            'create_date': l.create_date.isoformat() if l.create_date else None,
        } for l in logs]

        self._log_api_call('/api/v1/consultant/emails', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'showing_all': show_all,
            'count': len(emails),
            'emails': emails,
        })

    # ------------------------------------------------------------------
    # Tab "Pagamenti" (21/09/2026): compensi del consulente calcolati dallo
    # split V6 dei progetti dove compare come beneficiario 'consulente'.
    # Fonte: erpv6.tracking.relation.x_v6_revenue_split (JSON).
    # ------------------------------------------------------------------

