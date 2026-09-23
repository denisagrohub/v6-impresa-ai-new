"""Adapter pattern per provider di firma elettronica.

Ogni provider implementa la stessa interfaccia (send / check_status /
cancel / fetch_signed) cosi' `erpv6.sign.request` non sa quale provider
sta usando: cambia solo il campo `provider` su `erpv6.sign.config`.

Riferimento protocollo: RFC-style firma elettronica (eIDAS SES/AES/QES).
Documenso = AES via OTP email (self-hosted).
Certyneo = SES/AES/QES via API (hosted EU).
"""
import logging

_logger = logging.getLogger(__name__)


class SignatureProviderAdapter:
    """Interfaccia comune. Sottoclassi obbligate a implementare i 4 metodi."""

    code = 'base'
    name = 'Base'

    def __init__(self, config):
        self.config = config

    def send(self, sign_request):
        """Crea e invia la richiesta di firma.

        Ritorna un dict con:
          - status: 'sent'
          - external_id: id del documento sul provider
          - envelope_item_id: id opzionale per download
          - request_url: url pubblico per il firmatario
          - details: testo per il log
        """
        raise NotImplementedError

    def check_status(self, sign_request):
        """Legge lo stato del documento sul provider.

        Ritorna un dict con:
          - status: 'sent' | 'viewed' | 'signed' | 'declined' | 'cancelled' | invariato
          - signed_at: Datetime opzionale
          - viewed_at: Datetime opzionale
          - details: testo per il log
        """
        raise NotImplementedError

    def cancel(self, sign_request):
        """Annulla il documento sul provider (se non ancora firmato)."""
        raise NotImplementedError

    def fetch_signed(self, sign_request):
        """Scarica il PDF firmato.

        Ritorna bytes oppure None se non disponibile.
        """
        raise NotImplementedError
