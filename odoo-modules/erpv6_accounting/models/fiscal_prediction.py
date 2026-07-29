from odoo import models, fields, api
from odoo.exceptions import UserError
from datetime import datetime, date
import logging

_logger = logging.getLogger(__name__)


class FiscalPrediction(models.Model):
    _name = 'erpv6.fiscal.prediction'
    _description = 'Previsione Fiscale'
    _order = 'date desc'
    _inherit = ['mail.thread']

    # Relazioni
    company_id = fields.Many2one(
        'res.company', string='Azienda',
        required=True, default=lambda self: self.env.company
    )
    partner_id = fields.Many2one(
        'res.partner', string='Cliente',
        help='Cliente per cui è calcolata la previsione'
    )

    # Periodo
    date = fields.Date(
        'Data Calcolo', required=True,
        default=fields.Date.today
    )
    fiscal_year = fields.Char(
        'Anno Fiscale', compute='_compute_fiscal_year', store=True
    )

    # Dati input
    revenue_ytd = fields.Monetary(
        'Fatturato Anno Corrente', currency_field='currency_id'
    )
    revenue_forecast = fields.Monetary(
        'Fatturato Previsto Anno', currency_field='currency_id'
    )
    costs_ytd = fields.Monetary(
        'Costi Anno Corrente', currency_field='currency_id'
    )
    costs_forecast = fields.Monetary(
        'Costi Previsti Anno', currency_field='currency_id'
    )

    # Previsioni tasse
    predicted_iva = fields.Monetary(
        'IVA Prevista', currency_field='currency_id'
    )
    predicted_ires = fields.Monetary(
        'IRES Prevista', currency_field='currency_id'
    )
    predicted_irap = fields.Monetary(
        'IRAP Prevista', currency_field='currency_id'
    )
    predicted_regional = fields.Monetary(
        'Addizionali Regionali', currency_field='currency_id'
    )
    predicted_total = fields.Monetary(
        'Totale Tasse Previste', currency_field='currency_id',
        compute='_compute_totals', store=True
    )

    # Ottimizzazioni
    potential_savings = fields.Monetary(
        'Risparmio Potenziale', currency_field='currency_id'
    )
    optimized_total = fields.Monetary(
        'Totale Ottimizzato', currency_field='currency_id'
    )
    savings_percentage = fields.Float(
        '% Risparmio', compute='_compute_totals', store=True
    )

    # Kairós Finanziario (score 5-15)
    kairos_score = fields.Integer(
        'Kairós Score', compute='_compute_kairos', store=True
    )
    kairos_level = fields.Selection([
        ('BASSO', 'Basso (5-8)'),
        ('MEDIO', 'Medio (9-12)'),
        ('ALTO', 'Alto (13-15)'),
    ], string='Livello Kairós', compute='_compute_kairos', store=True)
    
    # Indicatori Kairós (1-3 ciascuno)
    kairos_stato_emotivo = fields.Integer('Stato Emotivo', default=2)
    kairos_energia = fields.Integer('Energia Team', default=2)
    kairos_risorse = fields.Integer('Risorse', default=2)
    kairos_pressione = fields.Integer('Pressione Esterna', default=2)
    kairos_storia = fields.Integer('Storia Tentativi', default=2)

    # Dati tecnici
    currency_id = fields.Many2one(
        'res.currency', string='Valuta',
        default=lambda self: self.env.company.currency_id
    )
    notes = fields.Text('Note')
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('calculated', 'Calcolata'),
        ('confirmed', 'Confermata'),
    ], string='Stato', default='draft')

    @api.depends('date')
    def _compute_fiscal_year(self):
        for rec in self:
            rec.fiscal_year = str(rec.date.year) if rec.date else False

    @api.depends('predicted_iva', 'predicted_ires', 'predicted_irap', 
                 'predicted_regional', 'potential_savings')
    def _compute_totals(self):
        for rec in self:
            rec.predicted_total = (
                rec.predicted_iva + rec.predicted_ires + 
                rec.predicted_irap + rec.predicted_regional
            )
            rec.optimized_total = rec.predicted_total - rec.potential_savings
            if rec.predicted_total > 0:
                rec.savings_percentage = (
                    rec.potential_savings / rec.predicted_total * 100
                )
            else:
                rec.savings_percentage = 0

    @api.depends('kairos_stato_emotivo', 'kairos_energia', 'kairos_risorse',
                 'kairos_pressione', 'kairos_storia')
    def _compute_kairos(self):
        """Calcola Kairós finanziario basato su 5 indicatori (1-3 ciascuno)"""
        for rec in self:
            score = (
                rec.kairos_stato_emotivo +
                rec.kairos_energia +
                rec.kairos_risorse +
                rec.kairos_pressione +
                rec.kairos_storia
            )
            rec.kairos_score = score
            if score >= 13:
                rec.kairos_level = 'ALTO'
            elif score >= 9:
                rec.kairos_level = 'MEDIO'
            else:
                rec.kairos_level = 'BASSO'

    def action_calculate(self):
        """Calcola previsioni fiscali basate su dati reali"""
        self.ensure_one()
        
        # Recupera fatture emesse (out_invoice)
        invoices_out = self.env['account.move'].search([
            ('move_type', '=', 'out_invoice'),
            ('state', '=', 'posted'),
            ('date', '>=', f'{self.fiscal_year}-01-01'),
            ('date', '<=', f'{self.fiscal_year}-12-31'),
            ('company_id', '=', self.company_id.id),
        ])
        
        # Recupera fatture ricevute (in_invoice)
        invoices_in = self.env['account.move'].search([
            ('move_type', '=', 'in_invoice'),
            ('state', '=', 'posted'),
            ('date', '>=', f'{self.fiscal_year}-01-01'),
            ('date', '<=', f'{self.fiscal_year}-12-31'),
            ('company_id', '=', self.company_id.id),
        ])
        
        # Calcola fatturato YTD
        self.revenue_ytd = sum(invoices_out.mapped('amount_untaxed'))
        
        # Calcola costi YTD
        self.costs_ytd = sum(invoices_in.mapped('amount_untaxed'))
        
        # Calcola IVA YTD (debito - credito)
        iva_debito = sum(invoices_out.mapped('amount_tax'))
        iva_credito = sum(invoices_in.mapped('amount_tax'))
        self.predicted_iva = max(0, iva_debito - iva_credito)
        
        # Determina regime fiscale dal partner
        regime = 'ordinario'
        coefficiente = 0.40
        if self.partner_id:
            regime = self.partner_id.v6_fiscal_regime or 'ordinario'
            coefficiente = self.partner_id.v6_coefficiente_redditivita or 0.40
        
        # Stima IRES/IRAP in base al regime
        if self.revenue_forecast > 0:
            if regime == 'forfettario':
                # Forfettario: coefficiente redditività + imposta sostitutiva
                reddito = self.revenue_forecast * coefficiente
                self.predicted_ires = reddito * 0.15  # 15% sostitutiva
                self.predicted_irap = 0  # Forfettari no IRAP
                self.predicted_regional = 0
            elif regime == 'agricolo_speciale':
                # Agricolo speciale: corrispettivi
                self.predicted_ires = self.revenue_forecast * 0.15 * 0.24
                self.predicted_irap = self.revenue_forecast * 0.02  # IRAP ridotta
                self.predicted_regional = self.revenue_forecast * 0.01
            else:
                # Ordinario/Semplificato
                profit_estimate = self.revenue_forecast - self.costs_forecast
                self.predicted_ires = max(0, profit_estimate * 0.24)
                self.predicted_irap = self.revenue_forecast * 0.039
                self.predicted_regional = self.revenue_forecast * 0.015
        else:
            # Stima basata su YTD
            self.predicted_ires = self.revenue_ytd * coefficiente * 0.24
            self.predicted_irap = self.revenue_ytd * 0.039
            self.predicted_regional = self.revenue_ytd * 0.015
        
        # Calcola risparmio potenziale dai suggerimenti
        suggestions = self.env['erpv6.deduction.suggestion'].search([
            ('company_id', '=', self.company_id.id),
            ('status', '=', 'available'),
        ])
        self.potential_savings = sum(s.tax_savings for s in suggestions)
        
        self.state = 'calculated'
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Previsione Calcolata',
                'message': f'Totale tasse previste: €{self.predicted_total:,.2f}',
                'type': 'success',
            }
        }

    def action_confirm(self):
        self.ensure_one()
        self.state = 'confirmed'
