from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # Campi fiscali V6
    v6_ateco_code = fields.Char(
        'Codice ATECO', size=10,
        help='Codice ATECO 2007 (es. 56.30.00)'
    )
    v6_ateco_description = fields.Char(
        'Descrizione ATECO'
    )
    v6_fiscal_regime = fields.Selection([
        ('ordinario', 'Ordinario'),
        ('semplificato', 'Semplificato'),
        ('forfettario', 'Forfettario'),
        ('agricolo_speciale', 'Agricolo Speciale (Corrispettivi)'),
    ], string='Regime Fiscale', default='ordinario')
    
    v6_coefficiente_redditivita = fields.Float(
        'Coefficiente Redditività',
        default=0.40,
        help='Percentuale di utile stimato (es. 0.40 = 40%)'
    )
    
    # Previsioni
    v6_predicted_annual_tax = fields.Monetary(
        'Tasse Annuali Previste', currency_field='currency_id',
        compute='_compute_predicted_tax', store=True
    )
    v6_revenue_forecast = fields.Monetary(
        'Fatturato Previsto', currency_field='currency_id'
    )

    # Kairós Finanziario
    v6_kairos_score = fields.Integer(
        'Kairós Finanziario', compute='_compute_kairos', store=True
    )
    v6_kairos_level = fields.Selection([
        ('BASSO', 'Basso'),
        ('MEDIO', 'Medio'),
        ('ALTO', 'Alto'),
    ], string='Livello Kairós', compute='_compute_kairos', store=True)

    @api.depends('v6_ateco_code', 'v6_fiscal_regime', 'v6_revenue_forecast')
    def _compute_predicted_tax(self):
        for partner in self:
            if partner.v6_revenue_forecast > 0:
                revenue = partner.v6_revenue_forecast
                regime = partner.v6_fiscal_regime or 'ordinario'
                
                if regime == 'forfettario':
                    coeff = partner.v6_coefficiente_redditivita or 0.40
                    reddito = revenue * coeff
                    ires = reddito * 0.15
                    iva = 0
                    irap = 0
                    regional = 0
                elif regime == 'agricolo_speciale':
                    ires = revenue * 0.15 * 0.24
                    iva = revenue * 0.05
                    irap = revenue * 0.02
                    regional = revenue * 0.01
                else:
                    # Ordinario/Semplificato
                    profit = revenue * (partner.v6_coefficiente_redditivita or 0.40)
                    ires = profit * 0.24
                    iva = revenue * 0.22
                    irap = revenue * 0.039
                    regional = revenue * 0.015
                
                partner.v6_predicted_annual_tax = iva + ires + irap + regional
            else:
                partner.v6_predicted_annual_tax = 0

    @api.depends('v6_revenue_forecast', 'v6_predicted_annual_tax')
    def _compute_kairos(self):
        for partner in self:
            score = 10  # Base
            
            if partner.v6_revenue_forecast > 0:
                net = partner.v6_revenue_forecast - partner.v6_predicted_annual_tax
                margin = net / partner.v6_revenue_forecast
                
                if margin > 0.5:
                    score += 3
                elif margin > 0.3:
                    score += 2
                else:
                    score += 1
            
            partner.v6_kairos_score = min(15, score)
            if score >= 13:
                partner.v6_kairos_level = 'ALTO'
            elif score >= 9:
                partner.v6_kairos_level = 'MEDIO'
            else:
                partner.v6_kairos_level = 'BASSO'

    @api.onchange('v6_ateco_code')
    def _onchange_ateco_code(self):
        """Auto-compila descrizione ATECO"""
        if self.v6_ateco_code:
            regime_obj = self.env['erpv6.ateco.regime'].search([
                ('code', '=', self.v6_ateco_code)
            ], limit=1)
            if regime_obj:
                self.v6_ateco_description = regime_obj.description
                if not self.v6_fiscal_regime:
                    self.v6_fiscal_regime = regime_obj.regime_default
