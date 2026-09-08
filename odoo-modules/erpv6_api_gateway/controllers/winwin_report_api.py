# pylint: disable=import-error
"""Winwin Report API Controller - stato/dati del report Win-Win asincrono
(prompt web-async, 06/09/2026). Come interview_api.py, erpv6_api_gateway
resta agnostico da erpv6_winwin_renderdata (duck-typing, risponde 501 se
il modulo non e' installato)."""
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class WinwinReportAPIController(APIBaseController):

    def _env_public(self):
        return request.env(user=request.env.ref('base.public_user'))

    def _find_token(self, env, token_str):
        return env['erpv6.winwin.report.token'].sudo().search([('token', '=', token_str)], limit=1)

    @http.route('/api/v1/winwin-report/status', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def report_status(self, **kwargs):
        """Endpoint di stato LEGGERO (Fase 1.3 del prompt): un solo lookup,
        nessun lavoro pesante - il frontend lo chiama una volta sola dopo
        l'attesa fissa (Fase 3), mai in un ciclo di polling continuo."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        env = self._env_public()
        if 'erpv6.winwin.report.token' not in env:
            self._log_api_call('/api/v1/winwin-report/status', 'GET', None, 501, start_time)
            return self._json_response({'error': 'Winwin report engine not installed'}, 501)

        token_str = kwargs.get('token')
        if not token_str:
            return self._json_response({'error': 'token required'}, 400)
        token = self._find_token(env, token_str)
        if not token:
            self._log_api_call('/api/v1/winwin-report/status', 'GET', None, 404, start_time)
            return self._json_response({'error': 'Token not found'}, 404)

        stato_pubblico = 'pronto' if token.stato in ('pronto', 'inviato_email') else 'in_elaborazione'
        self._log_api_call('/api/v1/winwin-report/status', 'GET', None, 200, start_time)
        return self._json_response({
            'stato': stato_pubblico,
            'report_url': token._report_url() if stato_pubblico == 'pronto' else None,
        }, 200)

    @http.route('/api/v1/winwin-report/data', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def report_data(self, **kwargs):
        """Ritorna il render_data completo (preview=true: sintesi/azioni
        win-win/roadmap/raccomandazione destinate al blur lato frontend,
        diagnosi/criticita/azioni_urgenti sempre in chiaro) per la pagina
        /report/[token] - letto dal record gia' salvato (winwin_render_data_final),
        nessun ricalcolo qui: e' un lookup, non lavoro pesante."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        env = self._env_public()
        if 'erpv6.winwin.report.token' not in env:
            self._log_api_call('/api/v1/winwin-report/data', 'GET', None, 501, start_time)
            return self._json_response({'error': 'Winwin report engine not installed'}, 501)

        token_str = kwargs.get('token')
        if not token_str:
            return self._json_response({'error': 'token required'}, 400)
        token = self._find_token(env, token_str)
        if not token:
            self._log_api_call('/api/v1/winwin-report/data', 'GET', None, 404, start_time)
            return self._json_response({'error': 'Token not found'}, 404)
        if token.stato not in ('pronto', 'inviato_email'):
            self._log_api_call('/api/v1/winwin-report/data', 'GET', None, 202, start_time)
            return self._json_response({'error': 'not_ready', 'stato': 'in_elaborazione'}, 202)

        render_data = token.production_order_id.winwin_render_data_final or {}
        # preview=True in ogni caso qui: questa pagina e' SEMPRE il teaser
        # pre-pagamento, mai il PDF completo (lo sblocco pagamento resta
        # mock, fuori scope di questo giro - vedi audit "Punto Zero").
        preview_data = dict(render_data, preview=True)
        self._log_api_call('/api/v1/winwin-report/data', 'GET', None, 200, start_time)
        return self._json_response(preview_data, 200)
