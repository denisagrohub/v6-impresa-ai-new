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


class ConsultantPaymentsAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/payments', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_payments(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.tracking.relation' not in env:
            self._log_api_call('/api/v1/consultant/payments', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'aeosv6_relation non installato'}, 501)

        Relation = env['erpv6.tracking.relation'].sudo()
        roots = Relation.search([('parent_id', '=', False), ('x_v6_revenue_split', '!=', False)])

        my_partner_id = user.partner_id.id
        payments = []

        for root in roots:
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
            except (json.JSONDecodeError, TypeError):
                continue

            beneficiari = split.get('beneficiari') or []
            mine = None
            for b in beneficiari:
                if (b.get('res_partner_id') == my_partner_id
                        and b.get('tipo') == 'consulente'):
                    mine = b
                    break
            if not mine:
                continue

            base = split.get('base') or {}
            base_tipo = base.get('tipo', 'fisso_unita')
            base_valore = float(base.get('valore') or 0)
            base_unita = base.get('unita') or ''
            mia_pct = float(mine.get('pct') or 0)

            payments.append({
                'project_id': root.id,
                'project_name': root.name,
                'base_tipo': base_tipo,
                'base_valore': base_valore,
                'base_unita': base_unita,
                'mia_pct': mia_pct,
                'mia_quota_teorica': round(base_valore * mia_pct / 100.0, 4),
                'split_approvato': bool(root.revenue_split_approved),
                'split_approvato_il': root.revenue_split_approved_at.isoformat() if root.revenue_split_approved_at else None,
                'split_hash': root.revenue_split_hash or '',
            })

        self._log_api_call('/api/v1/consultant/payments', 'GET', user.id, 200, start_time)
        return self._json_response({
            'count': len(payments),
            'payments': payments,
        })

    # ------------------------------------------------------------------
    # Playbook (23/09/2026): vista pronta da condividere col consulente.
    # Aggrega charter + dossier + target ideali + contatti scouting + KPI.
    # Solo owner/access/split possono vederlo.
    # ------------------------------------------------------------------

