# pylint: disable=import-error
"""Estende erpv6.credit.portfolio con attribuzione portatore + referral."""
from odoo import fields, models


class Erpv6CreditPortfolio(models.Model):
    _inherit = 'erpv6.credit.portfolio'

    brought_by_partner_id = fields.Many2one(
        'res.partner',
        string='Portatore',
        index=True,
        help='Chi ha portato il cedente. Se vuoto, eredita da '
             'cedente_id.brought_by_default_partner_id.')

    referral_id = fields.Many2one(
        'erpv6.referral',
        string='Referral collegato',
        help='Accordo referral firmato, se esiste.')

    co_segnalatore_ids = fields.One2many(
        'erpv6.attribution.co_signer',
        'portfolio_id',
        string='Co-segnalatori')

    co_segnalatore_count = fields.Integer(
        string='N. co-segnalatori',
        compute='_compute_co_segnalatore_count')

    attribution_confirmed = fields.Boolean(
        default=False,
        readonly=True,
        help='True dopo conferma del wizard (task 1b).')

    def _compute_co_segnalatore_count(self):
        for p in self:
            p.co_segnalatore_count = len(p.co_segnalatore_ids)
