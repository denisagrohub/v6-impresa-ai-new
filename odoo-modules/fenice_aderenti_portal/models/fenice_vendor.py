from odoo import models, fields, api

class FeniceVendor(models.Model):
    _name = 'fenice.vendor'
    _description = 'Vendor Aderente alla Rete Fenice'

    name = fields.Char(string='Nome Azienda', required=True)
    partner_id = fields.Many2one('res.partner', string='Partner Collegato', required=True)
    company_id = fields.Many2one('res.company', string='Rete Regionale', required=True, help='La rete regionale a cui appartiene questo vendor (es. Fattorie Venexiane, Fattorie Toscane)')
    
    fenice_livello = fields.Selection([
        ('I', 'Livello I - Terre Venete'),
        ('II', 'Livello II - Serenissima'),
        ('III', 'Livello III - Leone di San Marco'),
        ('IV', 'Livello IV - Fenice'),
    ], string='Livello Fenice')
    
    commission_rate = fields.Float(string='Commissione %', default=8.0)
    product_count = fields.Integer(string='Prodotti', compute='_compute_product_count')
    order_count = fields.Integer(string='Ordini', compute='_compute_order_count')
    total_sales = fields.Monetary(string='Vendite Totali', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', string='Currency', default=lambda self: self.env.company.currency_id)
    is_active = fields.Boolean(string='Attivo', default=True)

    @api.depends('partner_id')
    def _compute_product_count(self):
        for vendor in self:
            vendor.product_count = self.env['product.template'].search_count([('fenice_vendor_id', '=', vendor.id)])

    @api.depends('partner_id')
    def _compute_order_count(self):
        for vendor in self:
            vendor.order_count = self.env['sale.order'].search_count([('partner_id', '=', vendor.partner_id.id)])
