# pylint: disable=import-error
"""Estende res.partner con portatore abituale + referral default."""
from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    brought_by_default_partner_id = fields.Many2one(
        'res.partner',
        string='Portatore abituale',
        help='Chi ha portato questo contatto in V6. Default '
             'per le operazioni future (portfolio crediti, deal).')

    referral_default_id = fields.Many2one(
        'erpv6.referral',
        string='Referral abituale',
        help='Accordo referral firmato collegato a questo partner, '
             'se esiste.')
