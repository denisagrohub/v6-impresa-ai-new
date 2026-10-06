# pylint: disable=import-error
"""Modelli OTP + sessione KB (C-kb-3b).

Secondo fattore per accesso Knowledge Base: dopo JWT + access_level
serve un OTP 6 cifre via Telegram (bot V6 Auth). A verifica OK si
crea una sessione con TTL 1h.
"""
import logging
import secrets
from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6KbOtp(models.Model):
    _name = 'erpv6.kb.otp'
    _description = 'OTP per accesso KB'
    _order = 'create_date desc'

    user_id = fields.Many2one(
        'res.users', string='Utente',
        required=True, index=True, ondelete='cascade')
    code = fields.Char(string='Codice', required=True, size=6)
    purpose = fields.Selection([
        ('read', 'Lettura'),
    ], string='Scopo', required=True, default='read')
    expires_at = fields.Datetime(
        string='Scade il', required=True, index=True)
    used = fields.Boolean(string='Usato', default=False, index=True)
    used_at = fields.Datetime(string='Usato il')
    attempts = fields.Integer(string='Tentativi', default=0)
    ip_request = fields.Char(string='IP richiesta')
    ip_verify = fields.Char(string='IP verifica')

    _sql_constraints = [
        ('code_len', 'check (length(code) = 6)',
         'Il codice OTP deve essere di 6 cifre.'),
    ]

    @api.model
    def _generate_otp(self, user, purpose='read'):
        """Genera codice OTP 6 cifre, invia via Telegram V6 Auth.
        Invalida OTP pendenti dello stesso utente."""
        # Invalida precedenti non usati
        self.sudo().search([
            ('user_id', '=', user.id),
            ('used', '=', False),
        ]).write({'used': True, 'used_at': fields.Datetime.now()})

        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        expires = fields.Datetime.now() + timedelta(minutes=5)
        ip = None
        try:
            from odoo.http import request
            if request and hasattr(request, 'httprequest'):
                ip = request.httprequest.remote_addr
        except Exception:
            pass

        otp = self.sudo().create({
            'user_id': user.id,
            'code': code,
            'purpose': purpose,
            'expires_at': expires,
            'ip_request': ip,
        })

        # Invia via bot V6 Auth
        self._send_otp_telegram(user, code)

        # Audit log
        self.env['erpv6.kb.access.log'].sudo().create({
            'user_id': user.id,
            'action': 'otp_request',
            'details': 'purpose=%s otp_id=%s' % (purpose, otp.id),
            'ip_address': ip,
        })
        _logger.info('KB OTP generato per user %s (otp_id=%s)', user.name, otp.id)
        return otp

    @api.model
    def _send_otp_telegram(self, user, code):
        """Invia codice al bot V6 Auth (chat certificata)."""
        Link = self.env['erpv6.otp.bot.link'].sudo()
        link = Link.search([
            ('user_id', '=', user.id),
            ('revoked', '=', False),
        ], limit=1)
        if not link:
            raise UserError(
                'Chat Telegram non certificata. Apri /admin/kb e '
                'installa il bot V6 Auth.')

        Config = self.env['erpv6.agent.telegram.config'].sudo()
        bot = Config.search([
            ('mode', '=', 'otp'),
            ('is_active', '=', True),
        ], limit=1)
        if not bot:
            raise UserError('Bot V6 Auth non configurato.')

        text = (
            "🔐 *Codice accesso KB*\n\n"
            "`%s`\n\n"
            "Scade tra 5 minuti.\n"
            "Se non sei tu, ignora questo messaggio."
        ) % code
        bot._send_otp_message(link.chat_id, text)
        return True

    @api.model
    def _verify_otp(self, otp_id, code, ip, ua):
        """Verifica codice. Ritorna dict {ok, error?/session_token/expires_at}."""
        otp = self.sudo().browse(int(otp_id))
        if not otp.exists():
            return {'ok': False, 'error': 'OTP non trovato'}

        if otp.user_id.id != self.env.user.id:
            return {'ok': False, 'error': 'OTP non valido'}

        if otp.used:
            return {'ok': False, 'error': 'OTP già usato'}

        if otp.expires_at < fields.Datetime.now():
            return {'ok': False, 'error': 'OTP scaduto'}

        if otp.attempts >= 3:
            otp.write({'used': True, 'used_at': fields.Datetime.now()})
            return {'ok': False,
                    'error': 'Troppi tentativi. Richiedi nuovo codice.'}

        if (otp.code or '').strip() != (code or '').strip():
            otp.write({'attempts': otp.attempts + 1, 'ip_verify': ip})
            self.env['erpv6.kb.access.log'].sudo().create({
                'user_id': self.env.user.id,
                'action': 'otp_verify_fail',
                'details': 'otp_id=%s attempt=%s' % (otp.id, otp.attempts),
                'ip_address': ip,
            })
            return {'ok': False, 'error': 'Codice errato'}

        # OK
        otp.write({
            'used': True,
            'used_at': fields.Datetime.now(),
            'ip_verify': ip,
        })

        Session = self.env['erpv6.kb.session'].sudo()
        token = secrets.token_urlsafe(32)
        expires = fields.Datetime.now() + timedelta(hours=1)
        session = Session.create({
            'user_id': self.env.user.id,
            'token': token,
            'purpose': otp.purpose,
            'expires_at': expires,
            'ip_address': ip,
            'user_agent': ua[:200] if ua else None,
        })

        self.env['erpv6.kb.access.log'].sudo().create({
            'user_id': self.env.user.id,
            'action': 'otp_verify_ok',
            'details': 'session_id=%s' % session.id,
            'ip_address': ip,
        })

        return {
            'ok': True,
            'session_token': token,
            'expires_at': expires.isoformat(),
        }


class Erpv6KbSession(models.Model):
    _name = 'erpv6.kb.session'
    _description = 'Sessione KB sbloccata via OTP'
    _order = 'create_date desc'

    user_id = fields.Many2one(
        'res.users', string='Utente',
        required=True, index=True, ondelete='cascade')
    token = fields.Char(
        string='Token', required=True, index=True, size=64)
    purpose = fields.Selection([
        ('read', 'Lettura'),
    ], string='Scopo', required=True, default='read')
    expires_at = fields.Datetime(
        string='Scade il', required=True, index=True)
    revoked = fields.Boolean(string='Revocata', default=False, index=True)
    ip_address = fields.Char(string='IP')
    user_agent = fields.Char(string='User agent')

    @api.model
    def _cleanup_expired(self):
        """Pulizia sessioni scadute da >1 giorno (chiamata dal cron OTP)."""
        cutoff = fields.Datetime.now() - timedelta(days=1)
        old = self.sudo().search([('expires_at', '<', cutoff)])
        n = len(old)
        old.unlink()
        return n
