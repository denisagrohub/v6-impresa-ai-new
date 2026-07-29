from odoo import models, fields, api

class SaleOrder(models.Model):
    _inherit = 'sale.order'
    
    fenice_vendor_id = fields.Many2one('fenice.vendor', string='Vendor')
    fenice_commission_amount = fields.Monetary(string='Commissione Holding', compute='_compute_commission', store=True)
    fenice_vendor_amount = fields.Monetary(string='Importo Vendor', compute='_compute_commission', store=True)
    
    @api.depends('amount_total', 'fenice_vendor_id.commission_rate')
    def _compute_commission(self):
        for order in self:
            if order.fenice_vendor_id and order.amount_total > 0:
                commission = order.amount_total * (order.fenice_vendor_id.commission_rate / 100)
                order.fenice_commission_amount = commission
                order.fenice_vendor_amount = order.amount_total - commission
            else:
                order.fenice_commission_amount = 0
                order.fenice_vendor_amount = 0
