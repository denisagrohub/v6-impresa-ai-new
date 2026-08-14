# pylint: disable=import-error
import json
import logging
from odoo import http
from odoo.http import request, Response
from odoo.addons.erpv6_api_gateway.controllers.main import APIBaseController

_logger = logging.getLogger(__name__)


class SaaSAPIController(APIBaseController):

    @http.route('/api/v1/saas/verticals', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_verticals(self, **kwargs):
        """
        Ritorna la lista di verticali attivi.
        Richiede autenticazione tramite API Key nell'header Authorization: Bearer <key>
        """
        api_key, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            verticals = request.env['erpv6.vertical.catalog'].sudo().search([('is_active', '=', True)])
            data = [{
                'verticale': v.verticale,
                'name': v.name,
                'description': v.description or ''
            } for v in verticals]
            
            return self._json_response({'verticals': data})
            
        except Exception as e:
            _logger.error(f"Errore nel fetch verticali: {e}")
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/saas/verticals/<string:verticale>/modules', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_vertical_modules(self, verticale, **kwargs):
        """
        Ritorna la lista dei moduli per un verticale specifico.
        Richiede autenticazione tramite API Key nell'header Authorization: Bearer <key>
        """
        api_key, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            modules = request.env['erpv6.vertical.catalog'].sudo().get_modules_for_verticale(verticale)
            return self._json_response({'modules': modules})
            
        except Exception as e:
            _logger.error(f"Errore nel fetch moduli per verticale {verticale}: {e}")
            return self._json_response({'error': str(e)}, status=500)
