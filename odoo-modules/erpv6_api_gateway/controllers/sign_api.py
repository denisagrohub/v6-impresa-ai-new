# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class SignAPIController(APIBaseController):

    @http.route('/api/v1/sign/request', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_sign_request(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            data = request.get_json_data() or {}
            
            document_id = data.get('document_id')
            partner_id = data.get('partner_id')
            
            if not document_id:
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 400, start_time)
                return self._json_response({'error': 'document_id is required'}, status=400)
            
            document = request.env['ir.attachment'].sudo().browse(document_id)
            if not document.exists():
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Document not found'}, status=404)
            
            sign_partner = None
            if partner_id:
                sign_partner = request.env['res.partner'].sudo().browse(partner_id)
                if not sign_partner.exists():
                    self._log_api_call('/api/v1/sign/request', 'POST', user.id, 404, start_time)
                    return self._json_response({'error': 'Partner not found'}, status=404)
            else:
                sign_partner = user.partner_id
            
            if hasattr(request.env, 'erpv6.sign.request'):
                sign_request = request.env['erpv6.sign.request'].sudo().create({
                    'document_id': document_id,
                    'partner_id': sign_partner.id,
                    'requested_by': user.id,
                    'status': 'pending',
                })
                
                request_url = f"/sign/{sign_request.id}/{sign_partner.access_token or 'token'}"
                
                result = {
                    'request_id': sign_request.id,
                    'request_url': request_url,
                    'status': sign_request.status,
                }
                
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 200, start_time)
                return self._json_response(result, status=201)
            else:
                import secrets
                temp_request_id = int(time.time() * 1000) % 1000000
                access_token = secrets.token_urlsafe(32)
                
                result = {
                    'request_id': temp_request_id,
                    'request_url': f"/sign/{temp_request_id}/{access_token}",
                    'status': 'pending',
                    'document_name': document.name,
                    'partner_name': sign_partner.name,
                }
                
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 200, start_time)
                return self._json_response(result, status=201)
                
        except Exception as e:
            self._log_api_call('/api/v1/sign/request', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/sign/<int:request_id>/status', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_sign_status(self, request_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            if hasattr(request.env, 'erpv6.sign.request'):
                sign_request = request.env['erpv6.sign.request'].sudo().browse(request_id)
                if not sign_request.exists():
                    self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id, 404, start_time)
                    return self._json_response({'error': 'Sign request not found'}, status=404)
                
                signed_document_url = None
                if sign_request.signed_document_id:
                    signed_document_url = f"/api/v1/files/{sign_request.signed_document_id.id}/download"
                
                result = {
                    'request_id': sign_request.id,
                    'status': sign_request.status or 'pending',
                    'signed_at': sign_request.signed_at.isoformat() if sign_request.signed_at else None,
                    'signed_document_url': signed_document_url,
                    'signer_name': sign_request.partner_id.name if sign_request.partner_id else '',
                }
                
                self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id, 200, start_time)
                return self._json_response(result, status=200)
            else:
                result = {
                    'request_id': request_id,
                    'status': 'pending',
                    'signed_at': None,
                    'signed_document_url': None,
                    'note': 'Sign module not installed - demo response',
                }
                
                self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id, 200, start_time)
                return self._json_response(result, status=200)
                
        except Exception as e:
            self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
