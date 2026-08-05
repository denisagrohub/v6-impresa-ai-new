# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class PartnerAPIController(APIBaseController):

    @http.route('/api/v1/partner/profile', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_partner_profile(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            partner = user.partner_id.commercial_partner_id or user.partner_id
            
            ateco_code = ''
            fiscal_regime = ''
            
            if hasattr(partner, 'ateco_code') and partner.ateco_code:
                ateco_code = partner.ateco_code.code if hasattr(partner.ateco_code, 'code') else str(partner.ateco_code)
            
            if hasattr(partner, 'fiscal_regime') and partner.fiscal_regime:
                fiscal_regime = partner.fiscal_regime
            
            data = {
                'id': partner.id,
                'name': partner.name,
                'vat': partner.vat or '',
                'email': partner.email or '',
                'phone': partner.phone or '',
                'address': {
                    'street': partner.street or '',
                    'street2': partner.street2 or '',
                    'city': partner.city or '',
                    'zip': partner.zip or '',
                    'state': partner.state_id.name if partner.state_id else '',
                    'country': partner.country_id.name if partner.country_id else '',
                },
                'ateco_code': ateco_code,
                'fiscal_regime': fiscal_regime,
            }
            
            self._log_api_call('/api/v1/partner/profile', 'GET', user.id, 200, start_time)
            return self._json_response(data, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/partner/profile', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/partner/profile', type='http', auth='none', methods=['PUT', 'OPTIONS'], csrf=False)
    def update_partner_profile(self, **kwargs):
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            data = request.get_json(force=True, silent=True) or {}
            partner = user.partner_id.commercial_partner_id or user.partner_id
            
            vals = {}
            
            if 'name' in data:
                vals['name'] = data['name']
            if 'vat' in data:
                vals['vat'] = data['vat']
            if 'email' in data:
                vals['email'] = data['email']
            if 'phone' in data:
                vals['phone'] = data['phone']
            
            address_vals = {}
            if 'address' in data:
                addr = data['address']
                if 'street' in addr:
                    vals['street'] = addr['street']
                if 'street2' in addr:
                    vals['street2'] = addr['street2']
                if 'city' in addr:
                    vals['city'] = addr['city']
                if 'zip' in addr:
                    vals['zip'] = addr['zip']
            
            if vals:
                partner.write(vals)
            
            ateco_updated = False
            if 'ateco_code' in data and hasattr(partner, 'ateco_code'):
                ateco_obj = request.env['ateco.at'].sudo().search([('code', '=', data['ateco_code'])], limit=1)
                if ateco_obj:
                    partner.write({'ateco_code': ateco_obj.id})
                    ateco_updated = True
            
            if 'fiscal_regime' in data and hasattr(partner, 'fiscal_regime'):
                partner.write({'fiscal_regime': data['fiscal_regime']})
            
            updated_partner = user.partner_id.commercial_partner_id or user.partner_id
            
            self._log_api_call('/api/v1/partner/profile', 'PUT', user.id, 200, start_time)
            return self._json_response({
                'id': updated_partner.id,
                'name': updated_partner.name,
                'vat': updated_partner.vat or '',
                'email': updated_partner.email or '',
                'phone': updated_partner.phone or '',
                'address': {
                    'street': updated_partner.street or '',
                    'street2': updated_partner.street2 or '',
                    'city': updated_partner.city or '',
                    'zip': updated_partner.zip or '',
                    'state': updated_partner.state_id.name if updated_partner.state_id else '',
                    'country': updated_partner.country_id.name if updated_partner.country_id else '',
                },
                'ateco_code': data.get('ateco_code', ''),
                'fiscal_regime': data.get('fiscal_regime', ''),
            }, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/partner/profile', 'PUT', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
