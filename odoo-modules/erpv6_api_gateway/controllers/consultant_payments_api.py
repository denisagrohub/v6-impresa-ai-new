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

        # ─── PREVISIONI (dal template root — pagato solo se il deal si chiude)
        previsioni = []
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

            previsioni.append({
                'project_id': root.id,
                'project_name': root.name,
                'base_tipo': base_tipo,
                'base_valore': base_valore,
                'base_unita': base_unita,
                'mia_pct': mia_pct,
                'mia_quota_teorica': round(base_valore * mia_pct / 100.0, 4),
                'split_approvato': bool(root.revenue_split_approved),
                'split_approvato_il': self._iso_utc(root.revenue_split_approved_at) if root.revenue_split_approved_at else None,
                'split_hash': root.revenue_split_hash or '',
            })

        # ─── COMPENSI REALI (settlement line sui deal dove il partner è participant)
        # 30/09/2026 (fix business): prima si mostrava solo il template del
        # root come se fosse un compenso, ma i soldi arrivano solo dai deal
        # (settlement line). Questo è il dato vero.
        reali = []
        if 'erpv6.deal.settlement.line' in env:
            Line = env['erpv6.deal.settlement.line'].sudo()
            lines = Line.search([
                ('participant_id.partner_id', '=', my_partner_id),
                ('settlement_id.state', 'in', ['frozen', 'closed', 'sent', 'signed']),
            ])
            for l in lines:
                s = l.settlement_id
                deal = s.deal_id if hasattr(s, 'deal_id') else None
                periodo = ''
                if hasattr(s, 'periodo_mese') and hasattr(s, 'periodo_anno') and s.periodo_mese and s.periodo_anno:
                    periodo = f"{int(s.periodo_mese):02d}/{s.periodo_anno}"

                reali.append({
                    'id': l.id,
                    'deal_id': deal.id if deal else None,
                    'deal_name': deal.name if deal else (s.name or ''),
                    'deal_state': deal.state if deal else '',
                    'settlement_id': s.id,
                    'settlement_state': s.state,
                    'settlement_name': s.name,
                    'periodo': periodo,
                    'share_pct': float(l.share_pct or 0),
                    'importo_effettivo': float(l.importo_effettivo or 0),
                    'importo_sbloccato': float(l.importo_sbloccato or 0),
                    'pagamento_stato': l.pagamento_stato or '',
                    'giorni_ritardo': int(getattr(l, 'giorni_ritardo', 0) or 0),
                    'fattura_scadenza': self._iso_utc(l.fattura_scadenza) if getattr(l, 'fattura_scadenza', None) else None,
                    'pagato': bool(getattr(l, 'pagato', False)),
                    'pagato_il': self._iso_utc(l.pagato_il) if getattr(l, 'pagato_il', None) else None,
                    'paid_amount': float(getattr(l, 'paid_amount', 0) or 0),
                })

        self._log_api_call('/api/v1/consultant/payments', 'GET', user.id, 200, start_time)
        return self._json_response({
            'count': len(reali),
            'reali': reali,
            'previsioni': previsioni,
            'payments': previsioni,  # backward compat
        })

    # ------------------------------------------------------------------
    # Playbook (23/09/2026): vista pronta da condividere col consulente.
    # Aggrega charter + dossier + target ideali + contatti scouting + KPI.
    # Solo owner/access/split possono vederlo.
    # ------------------------------------------------------------------

