from odoo import models, fields, api

class FeniceProductAnalysis(models.Model):
    _name = 'fenice.product.analysis'
    _description = 'Analisi Prodotto da Dati di Mercato'
    _order = 'date desc'

    product_id = fields.Many2one('product.template', string='Prodotto', required=True, ondelete='cascade')
    date = fields.Date(string='Data Analisi', default=fields.Date.today, required=True)
    
    # Dati Amazon
    amazon_search_volume = fields.Integer(string='Ricerche Amazon')
    amazon_competitors_count = fields.Integer(string='N. Competitor Amazon')
    amazon_avg_price = fields.Float(string='Prezzo Medio Competitor (€)', digits=(10, 2))
    amazon_our_price = fields.Float(string='Nostro Prezzo (€)', digits=(10, 2))
    price_position = fields.Selection([
        ('below', 'Sotto Mercato'),
        ('aligned', 'Allineato'),
        ('above', 'Sopra Mercato'),
    ], string='Posizionamento Prezzo', compute='_compute_price_position', store=True)
    
    # Dati Complementari
    complement_products = fields.Text(string='Prodotti Complementari (JSON)')
    cross_sell_potential = fields.Float(string='Potenziale Cross-Sell (%)', digits=(5, 2))
    
    # Dati Nutrizionali (Open Food Facts)
    nutrition_data = fields.Text(string='Dati Nutrizionali (JSON)')
    certifications = fields.Char(string='Certificazioni (Bio, DOP, IGP)')
    
    # KPI
    market_opportunity_score = fields.Float(string='Score Opportunità Mercato (0-100)', digits=(5, 2))
    recommendation = fields.Text(string='Raccomandazione Strategica')
    
    @api.depends('amazon_avg_price', 'amazon_our_price')
    def _compute_price_position(self):
        for analysis in self:
            if analysis.amazon_avg_price and analysis.amazon_our_price:
                diff = (analysis.amazon_our_price - analysis.amazon_avg_price) / analysis.amazon_avg_price
                if diff < -0.05:
                    analysis.price_position = 'below'
                elif diff > 0.05:
                    analysis.price_position = 'above'
                else:
                    analysis.price_position = 'aligned'
            else:
                analysis.price_position = 'aligned'
