from odoo import models, fields, api
from datetime import date
import logging

_logger = logging.getLogger(__name__)


class AssetAdvisor(models.Model):
    _name = 'erpv6.asset.advisor'
    _description = 'Advisor Cespiti Intelligenti'
    _order = 'priority desc'

    company_id = fields.Many2one(
        'res.company', string='Azienda',
        required=True, default=lambda self: self.env.company
    )

    # Dati cespite
    name = fields.Char('Nome Cespite', required=True)
    category = fields.Selection([
        ('machinery', 'Macchinari'),
        ('vehicles', 'Veicoli'),
        ('it_equipment', 'Attrezzatura IT'),
        ('furniture', 'Arredamento'),
        ('buildings', 'Immobili'),
        ('software', 'Software'),
        ('other', 'Altro'),
    ], string='Categoria', required=True)

    # Valori
    purchase_value = fields.Monetary(
        'Valore Acquisto', currency_field='currency_id'
    )
    current_value = fields.Monetary(
        'Valore Attuale', currency_field='currency_id'
    )
    accumulated_depreciation = fields.Monetary(
        'Fondo Ammortamento', currency_field='currency_id'
    )
    net_value = fields.Monetary(
        'Valore Netto', currency_field='currency_id',
        compute='_compute_net_value', store=True
    )

    # Ammortamento
    depreciation_years = fields.Integer('Anni Ammortamento', default=5)
    annual_depreciation = fields.Monetary(
        'Ammortamento Annuo', currency_field='currency_id',
        compute='_compute_depreciation', store=True
    )
    purchase_date = fields.Date('Data Acquisto')

    # Bandi attivabili
    eligible_bandis = fields.Char(
        'Bandi Attivabili',
        compute='_compute_bandi', store=True,
        help='Es. Credito 4.0, 5.0, Transizione 5.0'
    )
    bandi_potential_credit = fields.Monetary(
        'Credito Potenziale Bandi', currency_field='currency_id',
        compute='_compute_bandi', store=True
    )
    bandi_details = fields.Text(
        'Dettagli Bandi',
        compute='_compute_bandi', store=True
    )

    # Timing
    suggested_purchase_date = fields.Date(
        'Data Acquisto Consigliata',
        help='Quando conviene acquistare per massimizzare benefici'
    )
    priority = fields.Selection([
        ('urgent', 'Urgente'),
        ('high', 'Alta'),
        ('medium', 'Media'),
        ('low', 'Bassa'),
    ], string='Priorità', default='medium')

    # Stato
    status = fields.Selection([
        ('planned', 'Pianificato'),
        ('purchased', 'Acquistato'),
        ('depreciating', 'In Ammortamento'),
        ('fully_depreciated', 'Completamente Ammortizzato'),
    ], string='Stato', default='planned')

    currency_id = fields.Many2one(
        'res.currency', string='Valuta',
        default=lambda self: self.env.company.currency_id
    )
    notes = fields.Text('Note')

    @api.depends('purchase_value', 'accumulated_depreciation')
    def _compute_net_value(self):
        for rec in self:
            rec.net_value = rec.purchase_value - rec.accumulated_depreciation

    @api.depends('purchase_value', 'depreciation_years')
    def _compute_depreciation(self):
        for rec in self:
            if rec.depreciation_years > 0:
                rec.annual_depreciation = rec.purchase_value / rec.depreciation_years
            else:
                rec.annual_depreciation = 0

    @api.depends('category', 'purchase_value')
    def _compute_bandi(self):
        """Calcola bandi attivabili in base a categoria e valore"""
        for rec in self:
            bandi_list = []
            total_credit = 0.0
            details = []
            
            # Credito 4.0 - Beni materiali e immateriali 4.0
            if rec.category in ['machinery', 'it_equipment', 'software']:
                credit_40 = rec.purchase_value * 0.20
                bandi_list.append('Credito 4.0')
                total_credit += credit_40
                details.append(f'Credito 4.0: 20% = €{credit_40:,.2f}')
            
            # Transizione 5.0 - Beni con risparmio energetico
            if rec.category in ['machinery']:
                credit_50 = rec.purchase_value * 0.35
                bandi_list.append('Transizione 5.0')
                total_credit += credit_50
                details.append(f'Transizione 5.0: 35% = €{credit_50:,.2f}')
            
            # Nuova Sabatini - Contributo interessi
            if rec.category in ['machinery', 'vehicles', 'it_equipment']:
                bandi_list.append('Nuova Sabatini')
                details.append('Nuova Sabatini: contributo interessi su leasing/finanziamento')
            
            # Beni strumentali - Super ammortamento
            if rec.category in ['machinery', 'it_equipment']:
                bandi_list.append('Super Ammortamento')
                details.append('Super Ammortamento: +15% costo fiscalmente riconosciuto')
            
            rec.eligible_bandis = ', '.join(bandi_list) if bandi_list else 'Nessun bando'
            rec.bandi_potential_credit = total_credit
            rec.bandi_details = '\n'.join(details) if details else 'Nessun bando attivabile'

    def action_check_bandi_eligibility(self):
        """Verifica bandi attivabili per questo cespite"""
        self.ensure_one()
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Bandi Verificati',
                'message': self.eligible_bandis,
                'type': 'info',
            }
        }
