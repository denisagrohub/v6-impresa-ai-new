# TEST ARGUS: verifica posizionamento esatto
# pylint: disable=import-error
import json
import logging
import time
from datetime import datetime, timedelta

from odoo import fields, http
from odoo.http import request, Response

_logger = logging.getLogger(__name__)

try:
    import jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False


class APIBaseController(http.Controller):

    def _json_response(self, data, status=200, error=None):
        body = {'success': status < 400, 'data': data, 'timestamp': datetime.utcnow().isoformat()}
        if error:
            body['error'] = error
        return Response(
            json.dumps(body, default=str), status=status, content_type='application/json',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        )

    def _authenticate(self, require_auth=True):
        start_time = time.time()
        auth = request.httprequest.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            api_key = request.env['erpv6.api.key'].sudo().search([('key', '=', auth[7:]), ('is_active', '=', True)], limit=1)
            if not api_key:
                self._log_api_call(request.httprequest.path, request.httprequest.method, None, 401, start_time)
                return None, self._json_response({'error': 'Invalid API Key'}, 401)
            if not api_key.check_endpoint_permission(request.httprequest.path):
                return None, self._json_response({'error': 'Endpoint not allowed'}, 403)
            api_key.write({'last_used': fields.Datetime.now(), 'usage_count': api_key.usage_count + 1})
            return api_key.user_id, None
        if auth.startswith('JWT ') and HAS_JWT:
            user = self._validate_jwt(auth[4:])
            if not user:
                return None, self._json_response({'error': 'Invalid JWT'}, 401)
            return user, None
        if require_auth:
            return None, self._json_response({'error': 'Authentication required'}, 401)
        return request.env.user, None

    def _validate_jwt(self, token):
        if not HAS_JWT:
            return None
        try:
            secret = request.env['ir.config_parameter'].sudo().get_param('api.jwt_secret')
            if not secret:
                return None
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user = request.env['res.users'].sudo().browse(payload.get('user_id'))
            return user if user.exists() and user.active else None
        except Exception:
            return None

    def _generate_jwt(self, user):
        if not HAS_JWT:
            return None
        secret = request.env['ir.config_parameter'].sudo().get_param('api.jwt_secret')
        if not secret:
            import secrets
            secret = secrets.token_urlsafe(32)
            request.env['ir.config_parameter'].sudo().set_param('api.jwt_secret', secret)
        return jwt.encode({'user_id': user.id, 'exp': datetime.utcnow() + timedelta(hours=24)}, secret, algorithm='HS256')

    def _log_api_call(self, endpoint, method, user_id, status_code, start_time):
        try:
            request.env['erpv6.api.log'].sudo().create({
                'endpoint': endpoint, 'method': method, 'user_id': user_id,
                'status_code': status_code, 'response_time_ms': int((time.time() - start_time) * 1000),
                'ip_address': request.httprequest.remote_addr,
            })
        except Exception:
            pass


class HealthController(APIBaseController):

    @http.route('/api/v1/health', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def health(self, **kwargs):  # pylint: disable=unused-argument
        return self._json_response({'status': 'healthy', 'version': '1.0.0'})

    @http.route('/api/v1/auth/login', type='json', auth='none', methods=['POST'], csrf=False)
    def login(self, **kwargs):
        start_time = time.time()
        uid = request.session.authenticate(request.db, kwargs.get('login'), kwargs.get('password'))
        if not uid:
            return self._json_response({'error': 'Invalid credentials'}, 401)
        user = request.env['res.users'].browse(uid)
        self._log_api_call('/api/v1/auth/login', 'POST', user.id, 200, start_time)
        return self._json_response({'token': self._generate_jwt(user), 'user': {'id': user.id, 'name': user.name}})
