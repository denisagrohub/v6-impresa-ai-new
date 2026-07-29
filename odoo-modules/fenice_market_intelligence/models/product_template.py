from odoo import models, fields, api

class ProductTemplate(models.Model):
    _inherit = 'product.template'
    
    # Campi Market Intelligence
    market_trend_ids = fields.Many2many('fenice.market.trend', string='Trend di Mercato Correlati')
    product_analysis_ids = fields.One2many('fenice.product.analysis', 'product_id', string='Analisi Prodotto')
    latest_analysis_id = fields.Many2one('fenice.product.analysis', string='Ultima Analisi', compute='_compute_latest_analysis')
    
    market_opportunity_score = fields.Float(string='Score Opportunità Mercato', digits=(5, 2), compute='_compute_market_score', store=True)
    is_trending = fields.Boolean(string='In Trend', compute='_compute_is_trending', store=True)
    
    @api.depends('product_analysis_ids')
    def _compute_latest_analysis(self):
        for product in self:
            if product.product_analysis_ids:
                product.latest_analysis_id = product.product_analysis_ids[0]
            else:
                product.latest_analysis_id = False
    
    @api.depends('product_analysis_ids.market_opportunity_score')
    def _compute_market_score(self):
        for product in self:
            if product.product_analysis_ids:
                product.market_opportunity_score = product.product_analysis_ids[0].market_opportunity_score
            else:
                product.market_opportunity_score = 0.0
    
    @api.depends('market_opportunity_score')
    def _compute_is_trending(self):
        for product in self:
            product.is_trending = product.market_opportunity_score > 70
