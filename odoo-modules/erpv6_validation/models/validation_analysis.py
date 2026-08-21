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
    # Correlati, non nuovi dati: omni_call_log_id gia' porta provider/modello
    # reali (tracciabilita' costi), qui solo esposti direttamente per non
    # dover aprire il log per sapere quale AI ha risposto a un giudice --
    # utile soprattutto ora che ci sono piu' provider (Groq/Cerebras/
    # OpenRouter) e non e' scontato quale abbia risposto per davvero.
    provider_name = fields.Char(related='omni_call_log_id.provider_id.name', string='Provider AI', store=True)
    model_used = fields.Char(related='omni_call_log_id.model_used', string='Modello AI', store=True)
    prompt_ref = fields.Char(
        string='Prompt Usato',
        help="Riferimento tracciabile al prompt/voce KB usato per QUESTA analisi (per-analista, "
             "non condiviso sul round) -- 'default motore' se nessun override. Aggiunto il "
             "21/08/2026 insieme al fix che ha dato ai 5 analisti prompt davvero diversi tra loro "
             "(prima erano tutti identici).",
    )
    findings = fields.Text(string='Risultati Analisi', help='Analisi in linguaggio naturale prodotta')
    claims_checked = fields.Json(string='Claim Verificati', help='Lista strutturata di oggetti {claim, source_verified, document_verified, note}')
    flagged_missing_data = fields.Text(string='Dati Mancanti Segnalati', help='Dati necessari ma non disponibili, MAI inventati')
