from odoo import models, fields, api

class FeniceVendor(models.Model):
    _name = 'fenice.vendor'
    _description = 'Vendor Fattorie Venexiane'

    name = fields.Char(string='Nome Azienda', required=True)
    partner_id = fields.Many2one('res.partner', string='Partner', required=True)
    company_id = fields.Many2one('res.company', string='Regione/Company', required=True)
    fenice_livello = fields.Selection([
        ('I', 'Livello I - Terre Venete'),
        ('II', 'Livello II - Serenissima'),
        ('III', 'Livello III - Leone di San Marco'),
        ('IV', 'Livello IV - Fenice'),
    ], string='Livello Fenice', default='I')
    
    commission_rate = fields.Float(string='Commissione %', compute='_compute_commission_rate', store=True)
    product_count = fields.Integer(string='Prodotti', compute='_compute_stats')
    order_count = fields.Integer(string='Ordini', compute='_compute_stats')
    total_sales = fields.Monetary(string='Vendite Totali', currency_field='currency_id', compute='_compute_stats')
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    is_active = fields.Boolean(string='Attivo', default=True)
    
    @api.depends('fenice_livello')
    def _compute_commission_rate(self):
        for vendor in self:
            if vendor.fenice_livello == 'IV':
                vendor.commission_rate = 4.0
            elif vendor.fenice_livello == 'III':
                vendor.commission_rate = 5.0
            else:
                vendor.commission_rate = 6.0
    
    def _compute_stats(self):
        for vendor in self:
            products = self.env['product.template'].search([('fenice_vendor_id', '=', vendor.id)])
            orders = self.env['sale.order'].search([('fenice_vendor_id', '=', vendor.id), ('state', 'in', ['sale', 'done'])])
            vendor.product_count = len(products)
            vendor.order_count = len(orders)
            vendor.total_sales = sum(orders.mapped('amount_total'))
