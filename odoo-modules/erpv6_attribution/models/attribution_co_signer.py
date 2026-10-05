# pylint: disable=import-error
"""Co-segnalatori: chi ha "passato il nome" e riceve una % della fee V6.

Modello collegato al portfolio (O2M). Un partner puo' essere
co-segnalatore di un portfolio una sola volta (unique constraint).
Percentuale tipica 0-5%, default 3%.
"""
from odoo import fields, models


class Erpv6AttributionCoSigner(models.Model):
    _name = 'erpv6.attribution.co_signer'
    _description = 'Co-segnalatore su operazione crediti'
    _order = 'portfolio_id, pct desc'

    portfolio_id = fields.Many2one(
        'erpv6.credit.portfolio',
        required=True, ondelete='cascade', index=True)

    partner_id = fields.Many2one(
        'res.partner',
        string='Partner',
        required=True, index=True,
        help='Chi ha passato il nome del cedente.')

    pct = fields.Float(
        string='% della fee V6',
        default=3.0,
        digits=(5, 2),
        help='Percentuale della fee V6 riconosciuta al co-segnalatore. '
             'Range consigliato 0-5%, default 3%.')

    notes = fields.Char(
        string='Motivo',
        help='Es. "ha aperto la relazione commerciale", '
             '"contatto storico".')

    _sql_constraints = [
        ('portfolio_partner_uniq',
         'unique(portfolio_id, partner_id)',
         'Un partner puo\' essere co-segnalatore una volta sola per portfolio.'),
        ('pct_range',
         'check (pct >= 0 and pct <= 10)',
         'La percentuale deve essere tra 0 e 10.'),
    ]
