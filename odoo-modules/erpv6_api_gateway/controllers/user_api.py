# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class UserAPIController(APIBaseController):

    @http.route('/api/v1/users/me', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_user_profile(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            partner = user.partner_id
            data = {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': partner.phone or '',
                'partner_id': partner.id,
                'company_id': user.company_id.id if user.company_id else None,
            }
            self._log_api_call('/api/v1/users/me', 'GET', user.id, 200, start_time)
            return self._json_response(data, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/users/me', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/users/me', type='http', auth='none', methods=['PUT', 'OPTIONS'], csrf=False)
    def update_user_profile(self, **kwargs):
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            data = request.get_json_data() or {}
            vals = {}
            
            if 'name' in data:
                vals['name'] = data['name']
            if 'email' in data:
                vals['email'] = data['email']
            if 'phone' in data:
                vals['phone'] = data['phone']
            
            if vals:
                user.write(vals)
                user.partner_id.write({k: v for k, v in vals.items() if k in ['phone']})
            
            self._log_api_call('/api/v1/users/me', 'PUT', user.id, 200, start_time)
            return self._json_response({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.partner_id.phone or '',
                'partner_id': user.partner_id.id,
                'company_id': user.company_id.id if user.company_id else None,
            }, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/users/me', 'PUT', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
