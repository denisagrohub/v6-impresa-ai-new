from odoo import models, fields, api

class FeniceKPIDashboard(models.Model):
    _name = 'fenice.kpi.dashboard'
    _description = 'Dashboard KPI Market Intelligence'

    name = fields.Char(string='Nome Dashboard', required=True)
    date = fields.Date(string='Data', default=fields.Date.today, required=True)
    
    # KPI Generali
    total_trends_tracked = fields.Integer(string='Trend Monitorati')
    trending_products_count = fields.Integer(string='Prodotti in Trend')
    high_opportunity_count = fields.Integer(string='Opportunità Alte')
    
    # KPI Amazon
    avg_amazon_price_variation = fields.Float(string='Variazione Media Prezzo vs Amazon (%)', digits=(5, 2))
    amazon_complements_found = fields.Integer(string='Prodotti Complementari Trovati')
    
    # KPI Google Trends
    avg_search_growth = fields.Float(string='Crescita Media Ricerche (%)', digits=(5, 2))
    top_trending_category = fields.Char(string='Categoria Top Trend')
    
    # KPI Competitor
    competitors_tracked = fields.Integer(string='Competitor Monitorati')
    avg_market_share = fields.Float(string='Quota Mercato Media Competitor (%)', digits=(5, 2))
    
    # Alert
    alert_count = fields.Integer(string='Alert Attivi')
    critical_alerts = fields.Integer(string='Alert Critici')
    
    # Insights
    top_insight = fields.Text(string='Insight Principale')
    recommendation = fields.Text(string='Raccomandazione Strategica')
    
    @api.model
    def generate_daily_dashboard(self):
        """Cron job: genera dashboard KPI giornaliera"""
        today = fields.Date.today()
        
        # Calcola KPI
        trends = self.env['fenice.market.trend'].search([('date', '=', today)])
        trending = trends.filtered(lambda t: t.is_trending)
        high_opp = trends.filtered(lambda t: t.opportunity_level == 'high')
        
        # Crea record dashboard
        dashboard = self.create({
            'name': f'Dashboard KPI - {today}',
            'date': today,
            'total_trends_tracked': len(trends),
            'trending_products_count': len(trending),
            'high_opportunity_count': len(high_opp),
            # ... altri KPI
        })
        
        return dashboard
