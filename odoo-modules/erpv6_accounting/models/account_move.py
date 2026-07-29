from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    # Campi V6
    v6_predicted_tax_impact = fields.Monetary(
        'Impatto Fiscale Previsto', currency_field='currency_id',
        compute='_compute_v6_tax_impact', store=True,
        help='Quanto pagherai di tasse su questa fattura'
    )
    v6_net_after_tax = fields.Monetary(
        'Netto Dopo Tasse', currency_field='currency_id',
        compute='_compute_v6_tax_impact', store=True,
        help='Quanto ti rimane realmente dopo le tasse'
    )
    v6_is_deductible = fields.Boolean(
        'È Deducibile', default=True,
        help='Questo costo è deducibile fiscalmente'
    )
    v6_deduction_rate = fields.Float(
        '% Deducibile', default=100.0
    )
    v6_tax_savings = fields.Monetary(
        'Risparmio Fiscale', currency_field='currency_id',
        compute='_compute_v6_tax_impact', store=True
    )

    # Collegamento SAL
    v6_sal_number = fields.Integer('Numero SAL')
    v6_project_id = fields.Many2one(
        'crm.lead', string='Progetto Collegato'
    )

    @api.depends('amount_total', 'move_type', 'v6_deduction_rate')
    def _compute_v6_tax_impact(self):
        for move in self:
            if move.move_type == 'out_invoice':
                # Fattura emessa: stima tasse da pagare
                profit_estimate = move.amount_untaxed * 0.4
                move.v6_predicted_tax_impact = (
                    move.amount_tax +
                    profit_estimate * 0.24 +
                    move.amount_untaxed * 0.039
                )
                move.v6_net_after_tax = (
                    move.amount_total - move.v6_predicted_tax_impact
                )
                move.v6_tax_savings = 0
            elif move.move_type == 'in_invoice':
                # Fattura ricevuta: calcolo risparmio fiscale
                if move.v6_is_deductible:
                    deductible = move.amount_untaxed * (move.v6_deduction_rate / 100)
                    move.v6_tax_savings = deductible * 0.24
                else:
                    move.v6_tax_savings = 0
                move.v6_predicted_tax_impact = -move.v6_tax_savings
                move.v6_net_after_tax = move.v6_tax_savings
            else:
                move.v6_predicted_tax_impact = 0
                move.v6_net_after_tax = 0
                move.v6_tax_savings = 0
