# pylint: disable=import-error
import json
import logging
import time

from odoo import fields, http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class BookingAPIController(APIBaseController):

    # Aggiunti 25/08/2026 (Denis - collegare per davvero il tab
    # calendario/call della dashboard consulente, mai vista finora,
    # al vero sistema di prenotazione Odoo invece del JSON finto su
    # disco in apps/impresa/src/data/consultant-calendar.json).
    #
    # erpv6.booking.token esisteva gia' (installato, ma con 0 righe reali
    # prima di oggi) ed e' un link di prenotazione monouso con sola
    # scadenza (validity_hours) - NON un calendario con giorno/ora: non
    # esiste nessun campo data/ora sul modello. Questi due endpoint
    # espongono quel modello cosi' com'e', senza inventare una semantica
    # di slot orari che oggi non esiste (vedi report finale per la
    # discrepanza rispetto a quanto assumeva il frontend mockato).
    @http.route('/api/v1/booking/tokens', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_available_tokens(self, **kwargs):
        start_time = time.time()
        consultant_id = kwargs.get('consultant_id')
        if not consultant_id:
            return self._json_response({'error': 'consultant_id richiesto'}, 400)
        consultant = request.env['erpv6.consulting.consultant'].sudo().browse(int(consultant_id))
        if not consultant.exists():
            return self._json_response({'error': 'Consulente non trovato'}, 404)

        tokens = request.env['erpv6.booking.token'].sudo().search([
            ('consultant_id', '=', consultant.id),
            ('status', '=', 'available'),
        ])
        # Un token scaduto ma non ancora marcato tale dal cron non va
        # comunque mai offerto come prenotabile.
        now = fields.Datetime.now()
        tokens = tokens.filtered(lambda t: not t.expires_at or t.expires_at > now)

        self._log_api_call('/api/v1/booking/tokens', 'GET', None, 200, start_time)
        return self._json_response({
            'consultant_name': consultant.partner_id.name,
            'tokens': [{
                'token': t.token,
                'expires_at': t.expires_at,
                'validity_hours': t.validity_hours,
            } for t in tokens],
        })

    @http.route('/api/v1/booking/generate', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def generate_tokens(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        consultant = request.env['erpv6.consulting.consultant'].sudo().search(
            [('partner_id', '=', user.partner_id.id)], limit=1)
        if not consultant:
            # Mai fabbricare un consulente al volo: se manca il collegamento
            # (vedi erpv6.consulting.consultant), va creato esplicitamente,
            # non dedotto qui dentro una request pubblica.
            self._log_api_call('/api/v1/booking/generate', 'POST', user.id, 400, start_time)
            return self._json_response(
                {'error': "Nessun erpv6.consulting.consultant collegato a questo utente - va creato prima."}, 400)

        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        count = min(int(data.get('count') or 1), 20)
        validity_hours = int(data.get('validity_hours') or 24)
        before = request.env['erpv6.booking.token'].sudo().search([('consultant_id', '=', consultant.id)])
        request.env['erpv6.booking.token'].sudo().generate_bulk(consultant.id, count, validity_hours)
        after = request.env['erpv6.booking.token'].sudo().search([('consultant_id', '=', consultant.id)]) - before

        self._log_api_call('/api/v1/booking/generate', 'POST', user.id, 200, start_time)
        return self._json_response({
            'tokens': [{'token': t.token, 'expires_at': t.expires_at} for t in after],
        })

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
