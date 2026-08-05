# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class SaasVerticalAPIController(APIBaseController):
    """API per gestione Verticali SaaS"""

    @http.route('/api/v1/saas/verticals', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_verticals_list(self, **kwargs):
        """
        GET /api/v1/saas/verticals
        Lista verticali attivi
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.vertical.catalog'):
                self._log_api_call('/api/v1/saas/verticals', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'SaaS module not installed'}, status=501)

            verticals = request.env['erpv6.vertical.catalog'].sudo().search([
                ('is_active', '=', True)
            ], order='name')

            result = []
            for vert in verticals:
                modules_list = []
                if vert.module_names:
                    modules_list = [m.strip() for m in vert.module_names.split(',') if m.strip()]
                
                result.append({
                    'id': vert.id,
                    'code': vert.verticale or '',
                    'name': vert.name or '',
                    'description': vert.description or '',
                    'modules': modules_list,
                    'modules_count': len(modules_list),
                })

            self._log_api_call('/api/v1/saas/verticals', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/saas/verticals', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/saas/verticals/<string:verticale>/modules', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_verticale_modules(self, verticale, **kwargs):
        """
        GET /api/v1/saas/verticals/<verticale>/modules
        Lista moduli per verticale specifico
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.vertical.catalog'):
                self._log_api_call(f'/api/v1/saas/verticals/{verticale}/modules', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'SaaS module not installed'}, status=501)

            vertical_record = request.env['erpv6.vertical.catalog'].sudo().search([
                ('verticale', '=', verticale),
                ('is_active', '=', True)
            ], limit=1)

            if not vertical_record:
                self._log_api_call(f'/api/v1/saas/verticals/{verticale}/modules', 'GET', user.id, 404, start_time)
                return self._json_response({'error': f'Verticale {verticale} not found'}, status=404)

            modules_list = []
            if vertical_record.module_names:
                modules_list = [m.strip() for m in vertical_record.module_names.split(',') if m.strip()]

            result = {
                'verticale': vertical_record.verticale,
                'name': vertical_record.name,
                'description': vertical_record.description or '',
                'modules': modules_list,
                'modules_count': len(modules_list),
            }

            self._log_api_call(f'/api/v1/saas/verticals/{verticale}/modules', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/saas/verticals/{verticale}/modules', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
