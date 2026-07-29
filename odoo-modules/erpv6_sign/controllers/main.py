from odoo import http
from odoo.http import request
import json
import logging

_logger = logging.getLogger(__name__)


class OpenSignController(http.Controller):
    
    @http.route('/api/opensign/callback', type='json', auth='public', methods=['POST'], csrf=False)
    def opensign_callback(self, **kwargs):
        """Callback da OpenSign quando lo stato cambia"""
        try:
            data = request.jsonrequest
            external_id = data.get('document_id')
            new_status = data.get('status')
            
            if not external_id:
                return {'success': False, 'error': 'Missing document_id'}
            
            # Trova la richiesta
            sign_request = request.env['erpv6.sign.request'].sudo().search([
                ('external_id', '=', external_id)
            ], limit=1)
            
            if not sign_request:
                return {'success': False, 'error': 'Request not found'}
            
            # Aggiorna stato
            status_map = {
                'viewed': 'viewed',
                'signed': 'signed',
                'completed': 'signed',
                'declined': 'declined',
            }
            
            if new_status in status_map:
                sign_request.write({'status': status_map[new_status]})
                
                # Log
                request.env['erpv6.sign.log'].sudo().create({
                    'request_id': sign_request.id,
                    'action': f'callback_{new_status}',
                    'details': f'Callback da OpenSign: {new_status}',
                })
            
            return {'success': True}
            
        except Exception as e:
            _logger.error(f'Errore callback OpenSign: {e}')
            return {'success': False, 'error': str(e)}
