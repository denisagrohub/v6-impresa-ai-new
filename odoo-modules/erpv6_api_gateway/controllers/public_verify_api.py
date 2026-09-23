# pylint: disable=import-error
"""Pagina pubblica di verifica firma (23/09/2026).

Chiunque abbia il QR code o il link /verify/<token> puo' vedere:
- hash SHA-256 del PDF firmato
- data firma
- nome firmatario (abbreviato)
- tipo documento
- esito: firma valida

NON mostra: importi, contenuto, email, altri dati sensibili.
Il token e' SHA-256 primi 24 char di (id|external_id|signed_at).
"""
import base64
import hashlib
import logging

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class PublicVerifyAPIController(APIBaseController):

    def _make_token(self, sign_request):
        raw = f'{sign_request.id}|{sign_request.external_id or ""}|{sign_request.signed_at or ""}'
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    @http.route('/api/v1/public/verify/<string:token>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_verify(self, token, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        if 'erpv6.sign.request' not in request.env.registry:
            return self._json_response({'error': 'Servizio firma non disponibile'}, 503)

        Sign = request.env['erpv6.sign.request'].sudo()
        candidates = Sign.search([('status', '=', 'signed')], limit=500)
        sr = None
        for c in candidates:
            if self._make_token(c) == token:
                sr = c
                break
        if not sr:
            return self._json_response({'error': 'Documento non trovato o non firmato'}, 404)

        hash_short = None
        if sr.signed_document:
            try:
                content = base64.b64decode(sr.signed_document)
                hash_short = hashlib.sha256(content).hexdigest()[:16]
            except Exception:
                pass

        partner_name = sr.partner_id.name or ''
        parts = partner_name.split()
        abbrev = f'{parts[0]} {parts[-1][0]}.' if len(parts) > 1 else partner_name
        kind_label = dict(sr._fields['related_kind'].selection).get(sr.related_kind or 'altro', 'Documento')

        return self._json_response({
            'valid': True,
            'token': token,
            'document_name': sr.name,
            'document_kind': kind_label,
            'signer_name': abbrev,
            'signed_at': sr.signed_at.isoformat() if sr.signed_at else None,
            'hash': hash_short,
            'provider': 'Documenso',
            'issuer': 'V6 Impresa S.r.l.',
            'verify_url': f'https://www.v6impresa.it/verify/{token}',
        })
