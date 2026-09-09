# pylint: disable=import-error
"""Partnership Candidacy API Controller - pagina pubblica '/partnership'
(09/09/2026, prompt "Candidatura partnership + routing token prodotto +
rotazione claim homepage", Parte A).

erpv6_api_gateway resta agnostico su erpv6_winwin_renderdata (dove vive
il modello erpv6.partnership.candidacy) - stesso pattern gia' usato in
lead_api.py per _promote_to_opportunity/_start_production (moduli
opzionali di erpv6_production): un controllo di esistenza sul registry
invece di una dipendenza rigida nel manifest, cosi' questo endpoint
degrada a 503 esplicito (mai un successo simulato) se il modulo non e'
installato, senza forzare erpv6_api_gateway a portarsi dietro tutte le
dipendenze pesanti di erpv6_winwin_renderdata (aeosv6_booking,
aeosv6_relation, erpv6_validation, erpv6_agent...) solo per questo
piccolo modello."""
import json
import logging

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class PartnershipAPIController(APIBaseController):

    @http.route('/api/v1/partnership-candidacy', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_candidacy(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        if 'erpv6.partnership.candidacy' not in request.env.registry:
            return self._json_response(
                {'error': 'Servizio candidature partnership non disponibile'}, 503,
            )

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        if not name or not email:
            return self._json_response({'error': 'name e email sono obbligatori'}, 400)

        # auth='none': nessuna sessione/uid valida - stesso schema di
        # lead_api.py, l'env va legato all'utente pubblico prima di
        # qualunque write (message_notify dentro action_create_from_public_form
        # fa un message_post, che senza uid reale crasha su _is_public()).
        env = request.env(user=request.env.ref('base.public_user'))

        try:
            result = env['erpv6.partnership.candidacy'].sudo().action_create_from_public_form(
                name=name,
                company_name=data.get('company_name') or data.get('company'),
                email=email,
                phone=data.get('phone'),
                proposal=data.get('proposal') or data.get('description'),
            )
        except Exception as e:  # UserError (validazione) o imprevisto - mai un 200 finto
            _logger.warning("Creazione candidatura partnership fallita: %s", e)
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({'id': result['id']})
