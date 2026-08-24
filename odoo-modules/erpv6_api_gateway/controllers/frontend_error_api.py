# pylint: disable=import-error
"""Frontend Error API Controller - riceve errori JS reali dal browser
(erpv6_core/static/src/js/error_reporter.js), li salva come dato
strutturato (erpv6.frontend.error) cosi' Kaizen puo' scoprirli senza
interrogare testo libero di log server."""
import json
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController


class FrontendErrorAPIController(APIBaseController):

    @http.route('/api/v1/frontend-error', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def report_frontend_error(self, **kwargs):  # pylint: disable=unused-argument
        """auth='none': un errore JS puo' avvenire anche prima del login
        (es. sulla pagina stessa di login) - non deve mai richiedere una
        sessione valida per essere segnalato. sudo() per lo stesso motivo
        di lead_api.py: env.user e' vuoto qui, serve legare a un utente
        reale per le scritture (message_post/tracked fields)."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        message = (data.get('message') or '').strip()
        if not message:
            return self._json_response({'error': 'message required'}, 400)

        env = request.env(user=request.env.ref('base.public_user'))
        env['erpv6.frontend.error'].sudo().create({
            'message': message[:500],
            'url': (data.get('url') or '')[:500],
            'stack': data.get('stack') or '',
            'user_agent': (data.get('user_agent') or '')[:300],
            'user_id': request.session.uid if request.session.uid else False,
        })

        self._log_api_call('/api/v1/frontend-error', 'POST', None, 201, start_time)
        return self._json_response({'ok': True}, 201)
