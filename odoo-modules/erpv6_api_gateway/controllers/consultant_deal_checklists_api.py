# pylint: disable=import-error
"""Consultant API — checklist deal per il consulente loggato.

30/09/2026 (Step B checklists): vista per deal che mostra la sequenza
di step documentali (NCND → NDA → Contratto Quadro → Split V6 →
Prospetto → Incasso) invece di una lista piatta di firme.

Il consulente vede i deal dove è participant, con:
- progress (done/total)
- step sequenziali con status + is_ready + is_blocking
- sign_request collegata (se esiste) con request_url per la firma
- next_step_code (cosa sbloccare adesso)
"""
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class ConsultantDealChecklistsAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/deal-checklists', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_deal_checklists(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.deal.checklist' not in env:
            self._log_api_call('/api/v1/consultant/deal-checklists', 'GET',
                               user.id, 501, start_time)
            return self._json_response(
                {'error': 'erpv6_winwin_renderdata non installato'}, 501)

        my_partner_id = user.partner_id.id
        Deal = env['erpv6.deal'].sudo()

        # Deal dove il partner è participant (qualunque role)
        deals = Deal.search([
            ('participant_ids.partner_id', '=', my_partner_id),
        ], order='write_date desc', limit=50)

        result = []
        for d in deals:
            steps = []
            for c in d.checklist_ids.sorted('sequence'):
                sr = c.sign_request_id if 'sign_request_id' in c._fields else None
                sign_info = None
                if sr:
                    sign_info = {
                        'id': sr.id,
                        'status': sr.status or 'draft',
                        'requestUrl': sr.request_url or None,
                        'signedAt': self._iso_utc(sr.signed_at) if sr.signed_at else None,
                        'sentAt': self._iso_utc(sr.sent_at) if sr.sent_at else None,
                    }
                steps.append({
                    'id': c.id,
                    'code': c.code,
                    'label': c.label,
                    'description': c.description or '',
                    'completionType': c.completion_type,
                    'status': c.status,
                    'isReady': bool(c.is_ready),
                    'isBlocking': bool(c.is_blocking),
                    'requiresCodes': c.requires_codes or '',
                    'sequence': c.sequence,
                    'signRequest': sign_info,
                })

            # Progress
            done = len([s for s in steps if s['status'] == 'done'])
            total = len(steps)
            na = len([s for s in steps if s['status'] == 'na'])
            total_eff = total - na

            # Next step = primo con status in (pending, in_progress) AND isReady
            next_step = None
            for s in steps:
                if s['status'] in ('pending', 'in_progress') and s['isReady']:
                    next_step = s
                    break

            if total == 0:
                continue  # deal senza checklist — skip

            result.append({
                'dealId': d.id,
                'dealName': d.name or '',
                'dealState': d.state or '',
                'dealSchema': d.schema_id.name if d.schema_id else '',
                'progress': {
                    'done': done,
                    'total': total_eff,
                    'pct': round((done / total_eff * 100)) if total_eff > 0 else 0,
                },
                'steps': steps,
                'nextStep': {
                    'code': next_step['code'],
                    'label': next_step['label'],
                    'hasSignRequest': bool(next_step.get('signRequest')),
                } if next_step else None,
            })

        self._log_api_call('/api/v1/consultant/deal-checklists', 'GET',
                           user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'deals': result,
            'total': len(result),
        })
