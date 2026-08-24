# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from odoo.exceptions import UserError
from .main import APIBaseController


class SignAPIController(APIBaseController):
    """Espone erpv6_sign (integrazione Documenso) sul gateway API.

    erpv6_api_gateway non dipende obbligatoriamente da erpv6_sign (il modulo
    firma è opzionale), quindi ogni chiamata verifica a runtime che il modello
    sia effettivamente installato tramite `'erpv6.sign.request' in request.env`
    (idiom corretto: `Environment.__contains__` controlla il registry dei
    modelli installati). Il vecchio codice usava
    `hasattr(request.env, 'erpv6.sign.request')`, che è SEMPRE False perché
    `request.env` non ha un attributo Python con quel nome punteggiato: il
    ramo "reale" non veniva quindi mai eseguito, e l'endpoint restituiva
    sempre un ID fittizio senza mai creare un vero erpv6.sign.request. Oltre
    al check rotto, i nomi di campo usati (`requested_by`, `signed_document_id`,
    `document_id` come `ir.attachment`) non corrispondevano nemmeno allo
    schema reale del modello: qui `document_id` è un Many2one a
    `erpv6.typst.document` (non un allegato generico), non esiste un campo
    `requested_by`, e il documento firmato è un Binary (`signed_document`),
    non un Many2one.
    """

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

            if 'erpv6.sign.request' not in request.env:
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 501, start_time)
                return self._json_response(
                    {'error': 'Sign module (erpv6_sign) not installed'}, status=501,
                )

            # document_id qui è l'id di un erpv6.typst.document (il modello
            # firmabile per cui esiste realmente un campo su erpv6.sign.request),
            # non di un ir.attachment generico.
            document = request.env['erpv6.typst.document'].sudo().browse(document_id)
            if not document.exists():
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Document not found'}, status=404)

            if partner_id:
                sign_partner = request.env['res.partner'].sudo().browse(partner_id)
                if not sign_partner.exists():
                    self._log_api_call('/api/v1/sign/request', 'POST', user.id, 404, start_time)
                    return self._json_response({'error': 'Partner not found'}, status=404)
            else:
                sign_partner = user.partner_id

            sign_request = request.env['erpv6.sign.request'].sudo().create({
                'name': document.name if hasattr(document, 'name') else f'Firma documento {document.id}',
                'document_id': document.id,
                'partner_id': sign_partner.id,
                'status': 'draft',
            })

            try:
                sign_request.action_send_to_sign()
            except UserError as e:
                # Il record resta comunque creato in 'draft': l'errore di invio
                # viene riportato al chiamante invece di far fallire l'intera
                # richiesta in modo silenzioso.
                self._log_api_call('/api/v1/sign/request', 'POST', user.id, 502, start_time)
                return self._json_response({
                    'request_id': sign_request.id,
                    'status': sign_request.status,
                    'error': str(e),
                }, status=502)

            result = {
                'request_id': sign_request.id,
                'request_url': sign_request.request_url or None,
                'status': sign_request.status,
            }

            self._log_api_call('/api/v1/sign/request', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)

        except Exception as e:
            self._log_api_call('/api/v1/sign/request', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
            # Nota: stesso pattern hasattr(request.env) gia' corretto qui, vedi module_kb/known_errors/hasattr_request_env.md.

    @http.route('/api/v1/sign/<int:request_id>/status', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_sign_status(self, request_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.sign.request' not in request.env:
                result = {
                    'request_id': request_id,
                    'status': 'pending',
                    'signed_at': None,
                    'signed_document_url': None,
                    'note': 'Sign module not installed - demo response',
                }
                self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id, 200, start_time)
                return self._json_response(result, status=200)

            sign_request = request.env['erpv6.sign.request'].sudo().browse(request_id)
            if not sign_request.exists():
                self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Sign request not found'}, status=404)

            # Aggiorna lo stato da Documenso prima di rispondere, cosi' il
            # chiamante non deve fare polling separato su action_check_status.
            sign_request.action_check_status()

            signed_document_url = None
            if sign_request.signed_document:
                signed_document_url = f'/web/content/erpv6.sign.request/{sign_request.id}/signed_document'

            result = {
                'request_id': sign_request.id,
                'status': sign_request.status or 'draft',
                'signed_at': sign_request.signed_at.isoformat() if sign_request.signed_at else None,
                'signed_document_url': signed_document_url,
                'signer_name': sign_request.partner_id.name if sign_request.partner_id else '',
            }

            self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)

        except Exception as e:
            self._log_api_call(f'/api/v1/sign/{request_id}/status', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
