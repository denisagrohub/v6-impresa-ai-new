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
            # 09/09/2026 (pagamento reale, audit "Punto Zero"): stato pagamento
            # vero (sale.order.state), mai un flag lato client - vedi report_data
            # sotto per il gate reale sui dati.
            'is_paid': token.is_paid,
        }, 200)

    @http.route('/api/v1/winwin-report/pay', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def report_pay(self, **kwargs):
        """Crea/riusa il sale.order del report e ritorna l'URL portale nativo
        Odoo per pagarlo (Stripe, gia' configurato come payment.provider) -
        il "carrello" richiesto da Denis e' questo sale.order, nessuna
        integrazione Stripe scritta qui ne' in Next.js."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        env = self._env_public()
        if 'erpv6.winwin.report.token' not in env:
            self._log_api_call('/api/v1/winwin-report/pay', 'POST', None, 501, start_time)
            return self._json_response({'error': 'Winwin report engine not installed'}, 501)

        token_str = kwargs.get('token')
        if not token_str:
            return self._json_response({'error': 'token required'}, 400)
        token = self._find_token(env, token_str)
        if not token:
            self._log_api_call('/api/v1/winwin-report/pay', 'POST', None, 404, start_time)
            return self._json_response({'error': 'Token not found'}, 404)
        if token.is_paid:
            self._log_api_call('/api/v1/winwin-report/pay', 'POST', None, 200, start_time)
            return self._json_response({'already_paid': True}, 200)

        payment_url = token.sudo().action_get_payment_url()
        base = env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        self._log_api_call('/api/v1/winwin-report/pay', 'POST', None, 200, start_time)
        return self._json_response({'payment_url': base.rstrip('/') + payment_url}, 200)

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
        # 09/09/2026 (pagamento reale, audit "Punto Zero"): 'schede' e
        # 'raccomandazione' restano nella risposta anche non pagato - per
        # design esplicito (BlurLock.tsx, commento originale) il teaser
        # sfoca TESTO REALE (scheda[1..3].come_funziona + raccomandazione),
        # mai lorem ipsum: toglierli romperebbe quella scelta di prodotto
        # gia' presa, non e' il bug da correggere qui. 'roadmap' invece non
        # serve MAI al teaser (usato solo nella vista sbloccata) - quello si
        # toglie per davvero se non pagato, prima serviva comunque a nulla
        # tranne regalare il contenuto pagato. preview=True prima era fisso
        # e ignorato dal frontend (sblocco = un click, zero pagamento) - ora
        # riflette lo stato reale del sale.order.
        response_data = dict(render_data)
        if not token.is_paid:
            response_data['roadmap'] = []
        response_data['preview'] = not token.is_paid
        self._log_api_call('/api/v1/winwin-report/data', 'GET', None, 200, start_time)
        return self._json_response(response_data, 200)
