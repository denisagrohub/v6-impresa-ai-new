"""Magic link per consulente (23/09/2026).

Pattern: email a Christian → link `https://www.v6impresa.it/c/<token>`.
Cliccando:
1. Backend valida token (esiste, non scaduto, non usato)
2. Invalida sessione corrente (cookie)
3. Genera JWT per l'utente corretto (Christian)
4. Setta cookie + redirect a dashboard consulente
5. Marca token come usato

Sicurezza: token random 32 char, scade 24h, monouso, legato a partner_id.
"""
import secrets
from datetime import timedelta

from odoo import api, fields, models


class ConsultantMagicLink(models.Model):
    _name = 'erpv6.consultant.magic.link'
    _description = 'Magic link monouso per autenticazione consulente'
    _order = 'create_date desc'

    name = fields.Char(string='Descrizione', required=True)
    token = fields.Char(string='Token', required=True, index=True, copy=False)
    partner_id = fields.Many2one('res.partner', string='Destinatario', required=True)
    user_id = fields.Many2one('res.users', string='Utente', required=True)
    purpose = fields.Selection([
        ('fiscal_data', 'Compila dati fiscali'),
        ('split_review', 'Rivedi split'),
        ('generic', 'Accesso generico'),
    ], string='Scopo', default='generic', required=True)
    expires_at = fields.Datetime(string='Scade il', required=True)
    used_at = fields.Datetime(string='Usato il', readonly=True)
    used_ip = fields.Char(string='IP usato', readonly=True)
    redirect_to = fields.Char(
        string='Redirect dopo login',
        help="Path relativo a cui redirigere dopo autenticazione (es. "
             "/consultant/dashboard?tab=profilo)")

    @api.model
    def _generate_token(self):
        return secrets.token_urlsafe(32)

    @api.model
    def create_for_partner(self, partner, purpose='generic', redirect_to=None, hours=24):
        """Crea un magic link per il partner. Ritorna record."""
        user = self.env['res.users'].sudo().search([
            ('partner_id', '=', partner.id), ('active', '=', True),
        ], limit=1)
        if not user:
            raise ValueError(f'Nessun utente attivo per partner {partner.name}')
        token = self._generate_token()
        expires = fields.Datetime.now() + timedelta(hours=hours)
        return self.sudo().create({
            'name': f'Magic link {purpose} per {partner.name}',
            'token': token,
            'partner_id': partner.id,
            'user_id': user.id,
            'purpose': purpose,
            'expires_at': expires,
            'redirect_to': redirect_to or '/consultant/dashboard',
        })

    def is_valid(self):
        self.ensure_one()
        if self.used_at:
            return False, 'Link già utilizzato'
        if self.expires_at < fields.Datetime.now():
            return False, 'Link scaduto'
        return True, None

    def mark_used(self, ip=None):
        self.ensure_one()
        self.sudo().write({
            'used_at': fields.Datetime.now(),
            'used_ip': ip or '',
        })

    def get_url(self):
        """URL pubblico da mettere nell'email."""
        self.ensure_one()
        base = 'https://www.v6impresa.it'
        return f'{base}/c/{self.token}'
