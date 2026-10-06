# pylint: disable=import-error
"""Bot OTP V6 Auth — mappatura chat↔utente + token monouso.

07/10/2026 (C-telegram-otp-bot-1): bot Telegram DEDICATO solo OTP,
separato da Susanna (operativo) e Claudio. Design (B+): polling
dedicato ogni 10s con long polling timeout=10, no webhook, no Caddy.
"""
import logging
import secrets
from datetime import timedelta

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6OtpBotLink(models.Model):
    """Mappatura chat Telegram ↔ utente V6 per il bot OTP."""
    _name = 'erpv6.otp.bot.link'
    _description = 'Mappatura chat bot V6 Auth'
    _order = 'linked_at desc'

    user_id = fields.Many2one(
        'res.users', string='Utente',
        required=True, index=True, ondelete='cascade')
    chat_id = fields.Char(
        string='Chat ID Telegram', required=True, index=True)
    linked_at = fields.Datetime(
        string='Collegato il', required=True,
        default=fields.Datetime.now)
    revoked = fields.Boolean(
        string='Revocato', default=False, index=True)

    _sql_constraints = [
        ('user_uniq', 'unique(user_id)',
         'Un utente = una chat certificata.'),
        ('chat_uniq', 'unique(chat_id)',
         'Una chat = un utente.'),
    ]


class Erpv6OtpBotToken(models.Model):
    """Token monouso per deep link /start. TTL 15 min."""
    _name = 'erpv6.otp.bot.token'
    _description = 'Token deep link bot OTP'
    _order = 'create_date desc'

    user_id = fields.Many2one(
        'res.users', string='Utente',
        required=True, index=True, ondelete='cascade')
    token = fields.Char(
        string='Token', required=True, index=True)
    expires_at = fields.Datetime(
        string='Scade il', required=True, index=True)
    used = fields.Boolean(
        string='Usato', default=False, index=True)
    used_at = fields.Datetime(string='Usato il')

    @api.model
    def _cleanup_expired(self):
        """Rimuove token scaduti da >1 giorno."""
        cutoff = fields.Datetime.now() - timedelta(days=1)
        old = self.sudo().search([('expires_at', '<', cutoff)])
        n = len(old)
        old.unlink()
        _logger.info('OTP bot token cleanup: %d rimossi', n)
        return n
