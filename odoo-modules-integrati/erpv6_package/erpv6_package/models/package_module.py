from odoo import api, fields, models
class Erpv6PackageModule(models.Model):
    _name = 'erpv6.package.module'
    _description = 'Modulo di servizio'
    name = fields.Char(required=True)
    code = fields.Char(required=True)
    price = fields.Monetary(required=True)
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    description = fields.Text()
    is_active = fields.Boolean(default=True)
