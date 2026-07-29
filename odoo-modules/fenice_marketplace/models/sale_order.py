from odoo import models, fields, api

class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'
    
    fenice_vendor_id = fields.Many2one('fenice.vendor', string='Vendor', related='product_id.fenice_vendor_id', store=True)
