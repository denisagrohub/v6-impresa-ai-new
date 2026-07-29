from odoo import models, fields, api

class FeniceCommissionReport(models.Model):
    _name = 'fenice.commission.report'
    _description = 'Report Commissioni Mensili'
    _order = 'date desc'
    
    date = fields.Date(string='Data', default=fields.Date.today)
    vendor_id = fields.Many2one('fenice.vendor', string='Vendor', required=True)
    order_ids = fields.Many2many('sale.order', string='Ordini')
    total_sales = fields.Monetary(string='Vendite Totali', currency_field='currency_id')
    commission_rate = fields.Float(string='Commissione %')
    commission_amount = fields.Monetary(string='Importo Commissione', currency_field='currency_id')
    vendor_amount = fields.Monetary(string='Importo Vendor', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('confirmed', 'Confermato'),
        ('paid', 'Pagato'),
    ], string='Stato', default='draft')
