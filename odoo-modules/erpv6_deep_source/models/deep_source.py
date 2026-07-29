from odoo import models, fields, api

class Erpv6Base(models.Model):
    _name = 'erpv6.base'
    _description = 'ERP V6 Base Model'

    name = fields.Char(string='Nome', required=True)
    code = fields.Char(string='Codice')
    active = fields.Boolean(string='Attivo', default=True)
    description = fields.Text(string='Descrizione')
