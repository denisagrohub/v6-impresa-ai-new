# pylint: disable=import-error
"""Admin API — vista aggregata checklist per tutti i deal.

30/09/2026 (P2): stessa logica di consultant/deal-checklists ma senza
filtro participant — l'admin vede TUTTI i deal con checklist, per
capire a colpo d'occhio chi è bloccato, dove, e chi deve agire.
"""
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class AdminDealChecklistsAPIController(APIBaseController):

    @http.route('/api/v1/admin/deal-checklists', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_admin_deal_checklists(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        env = request.env
        if 'erpv6.deal.checklist' not in env:
            return self._json_response({'error': 'modulo non installato'}, 501)

        # Filtro opzionale per stato deal (CSV)
        state_param = request.httprequest.args.get('state', '')
        domain = []
        if state_param:
            states = [s.strip() for s in state_param.split(',') if s.strip()]
            if states:
                domain.append(('state', 'in', states))

        # 08/10/2026 (C-security-audit-3efghj, Q-CHECKLISTS):
        # filtro server-side per consulenti. Admin/chief vedono tutto.
        is_admin_like = (
            user.has_group('base.group_system')
            or user.has_group('erpv6_core.group_chief_projects')
        )
        if not is_admin_like:
            # Consulente: solo deal dove e' owner o in relation.access_user_ids
            visible_rel_ids = self._get_visible_relation_ids(user) or []
            domain.append('|')
            domain.append(('owner_user_id', '=', user.id))
            if visible_rel_ids:
                domain.append(('relation_id', 'in', visible_rel_ids))
            else:
                # Nessun progetto visibile: solo owner
                # (rimuovo l'OR pendente)
                domain = [d for d in domain if d != '|']
                domain.append(('owner_user_id', '=', user.id))

        Deal = env['erpv6.deal'].sudo()
        deals = Deal.search(domain, order='write_date desc', limit=100)

        result = []
        for d in deals:
            if not d.checklist_ids:
                continue

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
                        'partnerName': sr.partner_id.name if sr.partner_id else None,
                    }
                steps.append({
                    'id': c.id,
                    'code': c.code,
                    'label': c.label,
                    'completionType': c.completion_type,
                    'status': c.status,
                    'isReady': bool(c.is_ready),
                    'isBlocking': bool(c.is_blocking),
                    'requiresCodes': c.requires_codes or '',
                    'sequence': c.sequence,
                    'signRequest': sign_info,
                })

            done = len([s for s in steps if s['status'] == 'done'])
            na = len([s for s in steps if s['status'] == 'na'])
            total = len(steps) - na

            next_step = None
            for s in steps:
                if s['status'] in ('pending', 'in_progress') and s['isReady']:
                    next_step = s
                    break

            result.append({
                'dealId': d.id,
                'dealName': d.name or '',
                'dealState': d.state or '',
                'dealSchema': d.schema_id.name if d.schema_id else '',
                'relationName': d.relation_id.name if d.relation_id else '',
                'progress': {
                    'done': done,
                    'total': total,
                    'pct': round((done / total * 100)) if total > 0 else 0,
                },
                'steps': steps,
                'nextStep': {
                    'code': next_step['code'],
                    'label': next_step['label'],
                    'hasSignRequest': bool(next_step.get('signRequest')),
                } if next_step else None,
            })

        self._log_api_call('/api/v1/admin/deal-checklists', 'GET',
                           user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'deals': result,
            'total': len(result),
        })
