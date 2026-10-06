# pylint: disable=import-error
"""Log accessi Knowledge Base (C-kb-3a Blocco C).

Registra chi legge/modifica le KB via API. NON logga i read()
interni del modello (troppo rumore dai 9 consumer con sudo).
Hook solo in kb_api.py.
"""
from odoo import fields, models


class Erpv6KbAccessLog(models.Model):
    _name = 'erpv6.kb.access.log'
    _description = 'Log accessi Knowledge Base'
    _order = 'create_date desc'

    user_id = fields.Many2one(
        'res.users', string='Utente',
        required=True, index=True, ondelete='cascade')

    kb_id = fields.Many2one(
        'erpv6.kb', string='KB',
        index=True, ondelete='set null')

    action = fields.Selection([
        ('list', 'Lista'),
        ('read', 'Lettura'),
        ('bundle', 'Bundle (contesto AI)'),
        ('write', 'Modifica'),
        ('delete', 'Eliminazione'),
        ('export', 'Export'),
        ('otp_request', 'Richiesta OTP'),
        ('otp_verify_ok', 'OTP OK'),
        ('otp_verify_fail', 'OTP fallito'),
        ('otp_bypass_admin', 'Bypass admin'),
    ], string='Azione', required=True, index=True)

    ip_address = fields.Char(string='IP')
    user_agent = fields.Char(string='User agent')
    details = fields.Text(string='Dettagli')

    # create_date è readonly by default su Odoo
