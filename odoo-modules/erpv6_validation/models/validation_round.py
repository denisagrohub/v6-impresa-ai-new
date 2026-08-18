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
    # Riferimento testuale (non un Many2one: questo modulo e' il motore
    # generico e non dipende da erpv6_kb) al prompt usato in questo round --
    # "default motore" se nessun override (erpv6_production) ha fornito una
    # voce KB kb_type='prompt', altrimenti "KB #<id> - <nome>" cosi' resta
    # tracciabile quale prompt (e quale sua versione/id) ha prodotto questo
    # risultato, anche nel certificato finale.
    analyst_prompt_ref = fields.Char(string='Prompt Analista Usato')
    sesto_prompt_ref = fields.Char(string='Prompt Sesto Uomo Usato')
    # True quando issues_found e' stato forzato da un fallimento REALE della
    # chiamata AI (vedi _run_round, error_sesto), non da un disaccordo di
    # contenuto genuino tra i giudici -- distingue le due cause di
    # un'escalation, cosi' _cron_retry_escalated_ai_failures puo' ritentare
    # solo i fallimenti tecnici e non toccare mai un'escalation per
    # contenuto reale (quella resta sempre umana, mai automatica).
    is_ai_failure = fields.Boolean(string='Escalation per fallimento tecnico AI', default=False)
