# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class Erpv6BandoApplication(models.Model):
    _name = 'erpv6.bando.application'
    _description = 'Candidatura Bando'
    _order = 'application_date DESC'
    _inherit = ['erpv6.core.tracked']

    match_id = fields.Many2one('erpv6.bando.match', string='Match', required=True, ondelete='cascade')
    bando_id = fields.Many2one('erpv6.bando', string='Bando', related='match_id.bando_id', store=True)
    partner_id = fields.Many2one('res.partner', string='Cliente', related='match_id.partner_id', store=True)
    application_date = fields.Date(string='Data Candidatura', default=fields.Date.today)
    reference_number = fields.Char(string='Numero Protocollo')
    amount_requested = fields.Monetary(string='Importo Richiesto', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('submitted', 'Inviata'),
        ('under_review', 'In Valutazione'),
        ('approved', 'Approvata'),
        ('rejected', 'Respinta'),
        ('funded', 'Erogata'),
    ], string='Stato', default='draft', tracking=True)
    documents_ids = fields.One2many('ir.attachment', 'res_id', string='Documenti', 
                                     domain=[('res_model', '=', 'erpv6.bando.application')])
    notes = fields.Html(string='Note')
    review_notes = fields.Html(string='Note Ente')
    funded_amount = fields.Monetary(string='Importo Erogato', currency_field='currency_id')

    def action_submit(self):
        """Invia candidatura"""
        self.ensure_one()
        self.status = 'submitted'
        return True

    def action_approve(self):
        """Approva candidatura"""
        self.ensure_one()
        self.status = 'approved'
        return True

    def action_reject(self):
        """Respingi candidatura"""
        self.ensure_one()
        self.status = 'rejected'
        return True

    def action_fund(self):
        """Segna come erogata"""
        self.ensure_one()
        self.status = 'funded'
        return True
