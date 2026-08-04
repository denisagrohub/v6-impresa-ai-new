# -*- coding: utf-8 -*-

from odoo import models, fields, api


class Erpv6ValidationAnalysis(models.Model):
    _name = 'erpv6.validation.analysis'
    _description = 'Analisi di Validazione'
    _order = 'analyst_index ASC'

    round_id = fields.Many2one('erpv6.validation.round', string='Round', required=True, ondelete='cascade')
    analyst_index = fields.Selection([
        ('1', 'Analista 1'),
        ('2', 'Analista 2'),
        ('3', 'Analista 3'),
        ('4', 'Analista 4'),
        ('5', 'Analista 5'),
        ('sesto', 'Sesto Uomo')
    ], string='Indice Analista', required=True)
    omni_call_log_id = fields.Many2one('erpv6.omni.call.log', string='Log Chiamata AI', help='Link alla chiamata AI reale per tracciabilità costi/provider')
    findings = fields.Text(string='Risultati Analisi', help='Analisi in linguaggio naturale prodotta')
    claims_checked = fields.Json(string='Claim Verificati', help='Lista strutturata di oggetti {claim, source_verified, document_verified, note}')
    flagged_missing_data = fields.Text(string='Dati Mancanti Segnalati', help='Dati necessari ma non disponibili, MAI inventati')
