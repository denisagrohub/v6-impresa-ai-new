from odoo import api, fields, models


class SignConfig(models.Model):
    _name = 'erpv6.sign.config'
    _description = 'Configurazione Firma Elettronica'

    name = fields.Char(string='Nome', default='Configurazione OpenSign')
    opensign_url = fields.Char(string='URL OpenSign', default='http://localhost:3000')
    api_key = fields.Char(string='API Key')
    active = fields.Boolean(string='Attivo', default=True)
