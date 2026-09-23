"""Adapter Certyneo — firma SES/AES/QES via API (hosted EU).

STATO: skeleton. Da completare quando avremo un account Certyneo
(anche free, 2 buste/mese) e la documentazione API aggiornata.

Endpoint ipotizzati (da confermare con la doc Certyneo):
- POST /v1/envelopes (create)
- POST /v1/envelopes/{id}/send (send)
- GET /v1/envelopes/{id} (status)
- DELETE /v1/envelopes/{id} (cancel)
- GET /v1/envelopes/{id}/documents/signed (download)

Config richiesta su erpv6.sign.config:
- certyneo_base_url (default https://api.certyneo.com)
- certyneo_api_key
- certyneo_webhook_secret (per verificare webhook in ingresso)
"""
import logging

import requests

from odoo import _
from odoo.exceptions import UserError

from .base import SignatureProviderAdapter

_logger = logging.getLogger(__name__)


class CertyneoAdapter(SignatureProviderAdapter):
    code = 'certyneo'
    name = 'Certyneo'

    def _base(self):
        return (self.config.certyneo_base_url or 'https://api.certyneo.com').rstrip('/')

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.config.certyneo_api_key or ""}',
            'Content-Type': 'application/json',
        }

    def send(self, sign_request):
        """Crea envelope + invia al firmatario.

        TODO quando arriva account Certyneo:
        1. Leggere PDF da sign_request.document_id.pdf_file
        2. POST /v1/envelopes con {name, documents, recipients, signatureLevel}
        3. signatureLevel = 'SES' | 'AES' | 'QES' (dalla policy)
        4. POST /v1/envelopes/{id}/send
        5. Ritornare stesso dict di Documenso
        """
        raise UserError(_('Provider Certyneo non ancora configurato. Contattare amministratore.'))

    def check_status(self, sign_request):
        """Legge stato envelope Certyneo (GET /v1/envelopes/{id})."""
        raise UserError(_('Provider Certyneo non ancora configurato.'))

    def cancel(self, sign_request):
        """DELETE /v1/envelopes/{id}."""
        raise UserError(_('Provider Certyneo non ancora configurato.'))

    def fetch_signed(self, sign_request):
        """GET /v1/envelopes/{id}/documents/signed -> bytes PDF."""
        raise UserError(_('Provider Certyneo non ancora configurato.'))
