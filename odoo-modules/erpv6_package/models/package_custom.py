from odoo import api, fields, models

class Erpv6PackageCustom(models.Model):
    _name = 'erpv6.package.custom'
    _description = 'Pacchetto personalizzato'

    name = fields.Char(required=True)
    partner_id = fields.Many2one('res.partner', required=True)
    module_ids = fields.Many2many('erpv6.package.module')
    total_price = fields.Monetary(compute='_compute_total', store=True)
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    discount = fields.Float(default=0.0)
    final_price = fields.Monetary(compute='_compute_final', store=True)
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('confirmed', 'Confermato'),
        ('sold', 'Venduto'),
    ], default='draft')

    @api.depends('module_ids')
    def _compute_total(self):
        for rec in self:
            rec.total_price = sum(rec.module_ids.mapped('price'))

    @api.depends('total_price', 'discount')
    def _compute_final(self):
        for rec in self:
            rec.final_price = rec.total_price * (1 - rec.discount / 100)
