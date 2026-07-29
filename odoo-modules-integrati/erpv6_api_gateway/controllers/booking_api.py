# pylint: disable=import-error
import json
import logging
import time

from odoo import fields, http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class BookingAPIController(APIBaseController):

    @http.route('/api/v1/booking/validate', type='http', auth='none', methods=['POST'], csrf=False)
    def validate_token(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        token = request.env['erpv6.booking.token'].sudo().search([('token', '=', data.get('token'))], limit=1)
        if not token:
            return self._json_response({'error': 'Not found'}, 404)
        if token.expires_at and token.expires_at < fields.Datetime.now():
            if token.status == 'available':
                token.write({'status': 'expired'})
            return self._json_response({'error': 'Expired'}, 410)
        if token.status != 'available':
            return self._json_response({'error': f'Status: {token.status}'}, 409)

        self._log_api_call('/api/v1/booking/validate', 'POST', None, 200, start_time)
        return self._json_response({'valid': True, 'consultant': token.consultant_id.partner_id.name})

    @http.route('/api/v1/booking/book', type='http', auth='none', methods=['POST'], csrf=False)
    def book_token(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        token = request.env['erpv6.booking.token'].sudo().search([('token', '=', data.get('token'))], limit=1)
        if not token:
            return self._json_response({'error': 'Not found'}, 404)

        try:
            token.write({'client_name': data.get('client_name'), 'client_email': data.get('client_email')})
            token.action_book()
        except Exception as e:
            return self._json_response({'error': str(e)}, 400)

        self._log_api_call('/api/v1/booking/book', 'POST', None, 200, start_time)
        return self._json_response({'success': True, 'booking_id': token.id})
