# pylint: disable=import-error
"""Consultant Sign API — firme del consulente loggato.

Espone la lista dei sign request dove il consulente e' il firmatario
(partner_id == user.partner_id). Read-only: il consulente puo' solo
vedere lo stato e scaricare i PDF firmati, non annullare/ricordare.

25/09/2026: creato per la tab "Firme" nella dashboard consulente.
"""
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class ConsultantSignAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/sign-requests',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_sign_requests(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.sign.request' not in env:
            self._log_api_call('/api/v1/consultant/sign-requests', 'GET',
                               user.id, 501, start_time)
            return self._json_response({'error': 'erpv6_sign non installato'}, 501)

        my_partner_id = user.partner_id.id

        Sign = env['erpv6.sign.request'].sudo()
        domain = [('partner_id', '=', my_partner_id)]

        # Filtro opzionale per stato (CSV)
        status_param = request.httprequest.args.get('status', '')
        if status_param:
            statuses = [s.strip() for s in status_param.split(',') if s.strip()]
            if statuses:
                domain.append(('status', 'in', statuses))
        else:
            # Default: tutto tranne cancelled
            domain.append(('status', '!=', 'cancelled'))

        srs = Sign.search(domain, order='create_date desc', limit=100)

        result = []
        for sr in srs:
            signed_doc_available = bool(sr.signed_document) if 'signed_document' in sr._fields else False
            result.append({
                'id': sr.id,
                'name': sr.name or '',
                'kind': sr.related_kind or 'altro',
                'status': sr.status or 'draft',
                'requestUrl': sr.request_url or None,
                'sentAt': sr.sent_at.isoformat() if sr.sent_at else None,
                'signedAt': sr.signed_at.isoformat() if sr.signed_at else None,
                'createdAt': sr.create_date.isoformat() if sr.create_date else None,
                'notes': sr.notes or None,
                'hasSignedDocument': signed_doc_available,
                'projectId': sr.split_project_id.id if sr.split_project_id else None,
                'projectName': sr.split_project_id.name if sr.split_project_id else None,
            })

        self._log_api_call('/api/v1/consultant/sign-requests', 'GET',
                           user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'signRequests': result,
            'total': len(result),
        })
