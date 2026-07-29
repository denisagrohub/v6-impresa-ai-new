# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    bandi_match_ids = fields.One2many('erpv6.bando.match', 'partner_id', string='Match Bandi')
    bandi_interested_count = fields.Integer(string='Bandi Interessati', compute='_compute_bandi_stats')
    bandi_applied_count = fields.Integer(string='Bandi Candidati', compute='_compute_bandi_stats')
    bandi_won_count = fields.Integer(string='Bandi Vinti', compute='_compute_bandi_stats')
    total_funded_amount = fields.Monetary(string='Importo Totale Erogato', 
                                           currency_field='currency_id',
                                           compute='_compute_bandi_stats')

    @api.depends('bandi_match_ids', 'bandi_match_ids.status', 'bandi_match_ids.importo_stimato')
    def _compute_bandi_stats(self):
        for partner in self:
            matches = partner.bandi_match_ids
            partner.bandi_interested_count = len(matches.filtered(lambda m: m.status == 'interested'))
            partner.bandi_applied_count = len(matches.filtered(lambda m: m.status == 'applied'))
            partner.bandi_won_count = len(matches.filtered(lambda m: m.status == 'won'))
            partner.total_funded_amount = sum(matches.filtered(lambda m: m.status == 'won').mapped('importo_stimato'))

    def action_view_bandis(self):
        """Apre la vista dei match bandi per il partner"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Match Bandi'),
            'res_model': 'erpv6.bando.match',
            'view_mode': 'tree,form',
            'domain': [('partner_id', '=', self.id)],
            'context': {'default_partner_id': self.id},
        }
