from odoo import models, fields

class ResPartner(models.Model):
    _inherit = 'res.partner'
    
    is_fenice_vendor = fields.Boolean(string='Vendor Fattorie Venexiane')
    fenice_vendor_id = fields.Many2one('fenice.vendor', string='Vendor Record')
    fenice_livello = fields.Selection([
        ('I', 'Livello I - Terre Venete'),
        ('II', 'Livello II - Serenissima'),
        ('III', 'Livello III - Leone di San Marco'),
        ('IV', 'Livello IV - Fenice'),
    ], string='Livello Fenice')
    provincia_id = fields.Many2one('res.country.state', string='Provincia', domain="[('country_id.code', '=', 'IT')]")
    anno_adesione = fields.Integer(string='Anno di Adesione')
    prodotti_principali = fields.Text(string='Prodotti Principali')
    logo_azienda = fields.Binary(string='Logo Azienda')
    is_public_profile = fields.Boolean(string='Profilo Pubblico sul Sito', default=False)
