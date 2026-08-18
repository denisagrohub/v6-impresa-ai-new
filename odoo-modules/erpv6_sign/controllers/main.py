from odoo import http
from odoo.http import request
import json
import logging

_logger = logging.getLogger(__name__)


class DocumensoWebhookController(http.Controller):

    @http.route('/api/documenso/webhook', type='http', auth='public', methods=['POST'], csrf=False)
    def documenso_webhook(self, **kwargs):  # pylint: disable=unused-argument
        """Riceve i webhook da Documenso (es. DOCUMENT_COMPLETED, DOCUMENT_REJECTED).

        Autenticazione: Documenso firma ogni chiamata webhook in uscita con
        l'header 'X-Documenso-Secret', il cui valore è quello impostato in fase
        di registrazione del webhook. Questo è un segreto DIVERSO dalla API Key
        usata dal modulo per chiamare Documenso (erpv6.sign.config.api_key):
        l'API Key autentica NOI verso Documenso (per creare/leggere envelope),
        questo secret autentica DOCUMENSO verso NOI (per fidarci di questa
        chiamata in ingresso). Sono due meccanismi distinti perché in Documenso
        v2 la gestione webhook (creazione/modifica) non è esposta sull'API
        pubblica con API Key: richiede una sessione utente autenticata via
        tRPC (endpoint interno /api/trpc/webhook.createWebhook, con cookie di
        sessione + header x-team-id) - per questo il webhook va registrato una
        tantum "a mano" (script/curl con login) e non può essere creato in
        automatico da questo modulo con la sola API Key.
        Confrontiamo quindi l'header ricevuto con erpv6.sign.config.webhook_secret,
        non con api_key.
        """
        try:
            received_secret = request.httprequest.headers.get('X-Documenso-Secret', '')
            config = request.env['erpv6.sign.config'].sudo().search([('active', '=', True)], limit=1)

            if not config or not config.webhook_secret or received_secret != config.webhook_secret:
                _logger.warning('Documenso webhook: secret mancante o non valido')
                return request.make_json_response({'success': False, 'error': 'Invalid secret'}, status=401)

            raw_body = request.httprequest.get_data()
            data = json.loads(raw_body or b'{}')

            event = data.get('event')
            payload = data.get('payload') or {}
            envelope_id = payload.get('envelopeId')

            if not envelope_id:
                return request.make_json_response({'success': False, 'error': 'Missing envelopeId'}, status=400)

            sign_request = request.env['erpv6.sign.request'].sudo().search([
                ('external_id', '=', envelope_id)
            ], limit=1)

            if not sign_request:
                _logger.info(f'Documenso webhook: nessuna richiesta trovata per envelope {envelope_id}')
                return request.make_json_response({'success': False, 'error': 'Request not found'}, status=404)

            if event == 'DOCUMENT_COMPLETED':
                # Riusa la stessa logica di mappatura stato + download del
                # pulsante 'Verifica Stato', invece di duplicarla qui.
                sign_request.action_check_status()
            elif event == 'DOCUMENT_REJECTED':
                sign_request.write({'status': 'declined'})
                request.env['erpv6.sign.log'].sudo().create({
                    'request_id': sign_request.id,
                    'action': 'callback_declined',
                    'details': 'Callback da Documenso: documento rifiutato',
                })

            return request.make_json_response({'success': True})

        except Exception as e:
            _logger.error(f'Errore webhook Documenso: {e}')
            return request.make_json_response({'success': False, 'error': str(e)}, status=500)
