# pylint: disable=import-error
"""Magic link auth (23/09/2026).

Endpoint pubblico /api/v1/auth/magic-link/<token>:
- valida token (esiste, non scaduto, non usato)
- genera JWT per l'utente corretto (Christian)
- marca token usato (con IP)
- ritorna JWT + dati utente + redirect_to

Il frontend /c/<token> riceve il JSON, salva JWT in localStorage
+ cookie (sovrascrivendo sessione precedente), poi redirect.
"""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class MagicLinkAPIController(APIBaseController):

    @http.route('/api/v1/auth/magic-link/<string:token>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def consume_magic_link(self, token, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        if 'erpv6.consultant.magic.link' not in request.env.registry:
            return self._json_response({'error': 'Servizio magic link non disponibile'}, 503)

        Link = request.env['erpv6.consultant.magic.link'].sudo()
        link = Link.search([('token', '=', token)], limit=1)
        if not link:
            self._log_api_call('/api/v1/auth/magic-link', 'GET', None, 404, start_time)
            return self._json_response({'error': 'Link non valido o scaduto'}, 404)

        valid, reason = link.is_valid()
        if not valid:
            self._log_api_call('/api/v1/auth/magic-link', 'GET', link.user_id.id, 410, start_time)
            return self._json_response({'error': reason or 'Link non piu valido'}, 410)

        user = link.user_id
        if not user or not user.active:
            return self._json_response({'error': 'Utente non attivo'}, 403)

        # genera JWT per l'utente corretto
        role = 'admin' if user.has_group('base.group_system') else (
            'consultant' if user.has_group('erpv6_core.group_consulente') else 'client'
        )
        jwt_token = self._generate_jwt(user, role=role)
        if not jwt_token:
            return self._json_response({'error': 'Generazione JWT fallita'}, 500)

        # marca usato con IP
        ip = request.httprequest.headers.get('X-Forwarded-For', '') or request.httprequest.remote_addr or ''
        link.mark_used(ip=ip)

        payload = {
            'token': jwt_token,
            'redirect_to': link.redirect_to or '/consultant/dashboard',
            'user': {
                'id': user.id,
                'login': user.login,
                'name': user.partner_id.name or user.login,
                'email': user.partner_id.email or '',
                'email_slug': user.email_slug or '',
                'role': role,
                'partnerId': user.partner_id.id,
            },
        }
        self._log_api_call('/api/v1/auth/magic-link', 'GET', user.id, 200, start_time)
        return self._json_response(payload)
