# -*- coding: utf-8 -*-

from odoo import models, fields, api


class Erpv6ValidationRound(models.Model):
    _name = 'erpv6.validation.round'
    _description = 'Round di Validazione'
    _order = 'round_number ASC'

    session_id = fields.Many2one('erpv6.validation.session', string='Sessione', required=True, ondelete='cascade')
    round_number = fields.Integer(string='Numero Round', required=True)
    analysis_ids = fields.One2many('erpv6.validation.analysis', 'round_id', string='Analisi')
    issues_found = fields.Integer(string='Problemi Trovati', help='Numero di claim/discrepanze segnalati dal Sesto Uomo')
    sesto_uomo_notes = fields.Text(string='Note Sesto Uomo', help='Sintesi/correzioni del sesto uomo per questo round')
    corrected_material = fields.Json(string='Materiale Corretto', help='Il materiale corretto dal sesto uomo, da ridistribuire al round successivo')
