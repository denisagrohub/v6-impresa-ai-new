"""Adapter Documenso — wrappa la logica di firma via API v2.

Nessun cambio funzionale rispetto al codice originale in sign_request.py:
il comportamento (payload, endpoint, timeout, mappatura stati) e' identico.
L'unica differenza e' che non scrive piu' su `self` ma ritorna dict.
"""
import base64
import json as json_lib
import logging

import requests

from odoo import _
from odoo.exceptions import UserError

from .base import SignatureProviderAdapter

_logger = logging.getLogger(__name__)


class DocumensoAdapter(SignatureProviderAdapter):
    code = 'documenso'
    name = 'Documenso'

    def _base(self):
        return self.config._api_base()

    def _headers(self):
        return self.config._api_headers()

    def send(self, sign_request):
        if not sign_request.document_id or not sign_request.document_id.pdf_file:
            raise UserError(_('Documento non disponibile'))
        if not sign_request.partner_id.email:
            raise UserError(_('Il firmatario non ha un indirizzo email'))

        pdf_bytes = base64.b64decode(sign_request.document_id.pdf_file)
        filename = sign_request.document_id.pdf_filename or f'{sign_request.name}.pdf'

        create_payload = {
            'title': sign_request.name,
            'type': 'DOCUMENT',
            'recipients': [{
                'email': sign_request.partner_id.email,
                'name': sign_request.partner_id.name or sign_request.partner_id.email,
                'role': 'SIGNER',
                'fields': [{
                    'type': 'SIGNATURE',
                    'page': 1, 'positionX': 70, 'positionY': 85,
                    'width': 25, 'height': 6,
                }],
            }],
        }

        create_resp = requests.post(
            f'{self._base()}/envelope/create',
            headers=self._headers(),
            data={'payload': json_lib.dumps(create_payload)},
            files={'files': (filename, pdf_bytes, 'application/pdf')},
            timeout=30,
        )
        if create_resp.status_code != 200:
            raise UserError(_('Errore creazione envelope Documenso: %s') % create_resp.text)
        envelope_id = create_resp.json()['id']

        detail_resp = requests.get(f'{self._base()}/envelope/{envelope_id}',
                                    headers=self._headers(), timeout=15)
        detail_resp.raise_for_status()
        envelope = detail_resp.json()
        items = envelope.get('envelopeItems') or []
        item_id = items[0]['id'] if items else False

        distribute_resp = requests.post(
            f'{self._base()}/envelope/distribute',
            headers=self._headers(),
            json={
                'envelopeId': envelope_id,
                'meta': {
                    'subject': _('Documento da firmare: %s') % sign_request.name,
                    'message': sign_request.notes or '',
                    'distributionMethod': 'EMAIL',
                },
            },
            timeout=30,
        )
        if distribute_resp.status_code != 200:
            raise UserError(_('Errore invio envelope Documenso: %s') % distribute_resp.text)
        data = distribute_resp.json()
        recipients = data.get('recipients') or []
        signing_url = recipients[0].get('signingUrl') if recipients else ''

        return {
            'status': 'sent',
            'external_id': envelope_id,
            'envelope_item_id': item_id,
            'request_url': signing_url or '',
            'details': f'Documenso envelope {envelope_id} inviato',
        }

    def check_status(self, sign_request):
        if not sign_request.external_id:
            return None
        resp = requests.get(
            f'{self._base()}/envelope/{sign_request.external_id}',
            headers=self._headers(), timeout=15,
        )
        if resp.status_code != 200:
            _logger.warning('check_status Documenso %s: %s', resp.status_code, resp.text[:200])
            return None
        env = resp.json()
        env_status = env.get('status')

        recipient = None
        for r in env.get('recipients') or []:
            if (r.get('email') or '').lower() == (sign_request.partner_id.email or '').lower():
                recipient = r
                break

        new_status = sign_request.status
        if env_status == 'COMPLETED':
            new_status = 'signed'
        elif env_status in ('REJECTED', 'CANCELLED'):
            new_status = 'declined'
        elif recipient and recipient.get('signingStatus') == 'SIGNED':
            new_status = 'signed'
        elif recipient and recipient.get('readStatus') == 'OPENED':
            new_status = 'viewed'

        if new_status == sign_request.status:
            return None
        return {
            'status': new_status,
            'details': f'Documenso stato {new_status}',
        }

    def cancel(self, sign_request):
        if not sign_request.external_id:
            return {'status': 'cancelled', 'details': 'Annullata localmente (nessun envelope remoto)'}
        resp = requests.delete(
            f'{self._base()}/envelope/{sign_request.external_id}',
            headers=self._headers(), timeout=15,
        )
        if resp.status_code not in (200, 202, 204, 404):
            raise UserError(_('Errore annullamento Documenso: HTTP %s') % resp.status_code)
        return {
            'status': 'cancelled',
            'details': f'Envelope Documenso annullato: {sign_request.external_id}',
        }

    def fetch_signed(self, sign_request):
        if not sign_request.envelope_item_id:
            return None
        resp = requests.get(
            f'{self._base()}/envelope/item/{sign_request.envelope_item_id}/download',
            headers=self._headers(), timeout=30,
        )
        if resp.status_code == 200:
            return resp.content
        _logger.warning('download firmato Documenso: %s', resp.status_code)
        return None
