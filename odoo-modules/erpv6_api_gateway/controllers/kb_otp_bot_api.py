# pylint: disable=import-error
"""API bot OTP per UI Next (C-telegram-otp-bot-1).

Espone:
  GET  /api/v1/users/telegram-otp/status         -> {linked, chat_id_masked, linked_at}
  POST /api/v1/users/telegram-otp/generate-link  -> {deep_link, qr_data, expires_at}

Il polling degli update e' gestito dal cron V6 Auth (mode='otp'),
NON da questi endpoint.
"""
import logging

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class KbOtpBotAPIController(ConsultantAPIController):

    @http.route('/api/v1/users/telegram-otp/status',
                type='http', auth='none', methods=['GET', 'OPTIONS'],
                csrf=False)
    def otp_status(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        cfg = request.env['erpv6.agent.telegram.config'].sudo()
        status = cfg.get_otp_link_status(user)
        return self._json_response(status)

    @http.route('/api/v1/users/telegram-otp/generate-link',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def otp_generate_link(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        # Rate limit: 5 link/ora per utente (best-effort, contando
        # i token generati negli ultimi 60 minuti)
        from datetime import timedelta
        from odoo import fields as _fields
        cutoff = _fields.Datetime.now() - timedelta(hours=1)
        recent = request.env['erpv6.otp.bot.token'].sudo().search_count([
            ('user_id', '=', user.id),
            ('create_date', '>=', cutoff),
        ])
        if recent >= 5:
            return self._json_response({
                'error': 'Troppi link generati nell\'ultima ora. '
                         'Riprova tra qualche minuto.'
            }, 429)

        # Bot username: leggo da ir.config_parameter (opzionale)
        ICP = request.env['ir.config_parameter'].sudo()
        bot_username = ICP.get_param(
            'erpv6.otp_bot.username', 'V6AuthBot')

        cfg = request.env['erpv6.agent.telegram.config'].sudo()
        data = cfg.generate_otp_deep_link(user, bot_username=bot_username)

        return self._json_response({
            'ok': True,
            'deep_link': data['deep_link'],
            'qr_data': data['qr_data'],
            'expires_at': data['expires_at'].isoformat()
                if data.get('expires_at') else None,
        })

    @http.route('/api/v1/users/telegram-otp/revoke',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def otp_revoke(self, **kwargs):
        """Revoca la mappatura chat dell'utente."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Link = request.env['erpv6.otp.bot.link'].sudo()
        links = Link.search([
            ('user_id', '=', user.id),
            ('revoked', '=', False),
        ])
        n = len(links)
        links.write({'revoked': True})
        _logger.info('OTP bot: revocati %d link per user %s', n, user.name)
        return self._json_response({'ok': True, 'revoked': n})
