from odoo import models, fields

class ProductTemplate(models.Model):
    _inherit = 'product.template'
    
    fenice_vendor_id = fields.Many2one('fenice.vendor', string='Vendor Fattorie Venexiane')
    fenice_categoria = fields.Selection([
        ('lattiero', 'Lattiero-Caseario'),
        ('salumi', 'Salumi e Carni'),
        ('ortaggi', 'Ortaggi e Frutta'),
        ('bevande', 'Bevande e Vini'),
        ('conserve', 'Conserve e Marmellate'),
        ('altro', 'Altro'),
    ], string='Categoria Prodotto')
