from odoo import models, fields, api
from datetime import datetime, timedelta

class FeniceMarketTrend(models.Model):
    _name = 'fenice.market.trend'
    _description = 'Trend di Mercato da API Esterne'
    _order = 'date desc'
    _inherit = ['mail.thread']

    name = fields.Char(string='Nome Trend', required=True, tracking=True)
    date = fields.Date(string='Data Rilevazione', default=fields.Date.today, required=True)
    source = fields.Selection([
        ('amazon', 'Amazon Product API'),
        ('google_trends', 'Google Trends'),
        ('open_food_facts', 'Open Food Facts'),
        ('istat', 'ISTAT'),
        ('other', 'Altro'),
    ], string='Fonte Dati', required=True)
    
    category = fields.Selection([
        ('formaggi', 'Formaggi'),
        ('salumi', 'Salumi e Carni'),
        ('ortaggi', 'Ortaggi e Frutta'),
        ('bevande', 'Bevande e Vini'),
        ('conserve', 'Conserve e Marmellate'),
        ('biologico', 'Biologico'),
        ('km0', 'Km0 e Filiera Corta'),
        ('sostenibile', 'Sostenibile'),
    ], string='Categoria Prodotto')
    
    # Metriche
    search_volume = fields.Integer(string='Volume Ricerche')
    trend_score = fields.Float(string='Trend Score (0-100)', digits=(5, 2))
    growth_rate = fields.Float(string='Tasso Crescita (%)', digits=(5, 2))
    seasonality = fields.Selection([
        ('alta', 'Alta Stagionalità'),
        ('media', 'Media Stagionalità'),
        ('bassa', 'Bassa Stagionalità'),
    ], string='Stagionalità')
    
    # Dati Amazon
    amazon_best_seller_rank = fields.Integer(string='Amazon Best Seller Rank')
    amazon_avg_price = fields.Float(string='Prezzo Medio Amazon (€)', digits=(10, 2))
    amazon_complements = fields.Text(string='Prodotti Complementari (JSON)')
    
    # Analisi
    sentiment_score = fields.Float(string='Sentiment Score (0-100)', digits=(5, 2))
    opportunity_level = fields.Selection([
        ('low', 'Bassa'),
        ('medium', 'Media'),
        ('high', 'Alta'),
    ], string='Livello Opportunità')
    
    notes = fields.Text(string='Note e Insight')
    
    # Relazioni
    product_ids = fields.Many2many('product.template', string='Prodotti Correlati')
    
    # KPI derivati
    is_trending = fields.Boolean(string='In Trend', compute='_compute_is_trending', store=True)
    
    @api.depends('trend_score', 'growth_rate')
    def _compute_is_trending(self):
        for trend in self:
            trend.is_trending = trend.trend_score > 70 or trend.growth_rate > 20
    
    def action_view_products(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Prodotti Correlati',
            'res_model': 'product.template',
            'domain': [('id', 'in', self.product_ids.ids)],
            'view_mode': 'tree,form',
        }
