from odoo import models, fields

class FeniceCompetitor(models.Model):
    _name = 'fenice.competitor'
    _description = 'Analisi Competitor'
    _order = 'market_share desc'

    name = fields.Char(string='Nome Competitor', required=True)
    website = fields.Char(string='Sito Web')
    category = fields.Selection([
        ('formaggi', 'Formaggi'),
        ('salumi', 'Salumi'),
        ('ortaggi', 'Ortaggi'),
        ('bevande', 'Bevande'),
        ('marketplace', 'Marketplace Multi-Vendor'),
    ], string='Categoria')
    
    # Metriche
    market_share = fields.Float(string='Quota Mercato Stimata (%)', digits=(5, 2))
    avg_price_index = fields.Float(string='Indice Prezzo Medio', digits=(5, 2))
    product_range = fields.Integer(string='N. Prodotti Catalogo')
    
    # Presenza Digitale
    website_traffic = fields.Integer(string='Traffico Mensile Stimato')
    social_followers = fields.Integer(string='Followers Social')
    amazon_presence = fields.Boolean(string='Presente su Amazon')
    
    # SWOT
    strengths = fields.Text(string='Punti di Forza')
    weaknesses = fields.Text(string='Punti di Debolezza')
    opportunities = fields.Text(string='Opportunità')
    threats = fields.Text(string='Minacce')
    
    notes = fields.Text(string='Note')
