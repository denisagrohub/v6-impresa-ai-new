# pylint: disable=import-error
"""Regola di generazione suggerimenti (configurabile da UI).

02/10/2026 (C1b-1 refactor): prima le regole erano hardcoded in rules.py.
Ora sono record DB modificabili da Impostazioni > Suggerimenti > Regole.
Il codice implementa solo i "matcher_type" (6 tipi generici); i parametri
(target_model, soglie, stati, template) sono dati.
"""
from odoo import api, fields, models


MATCHER_TYPES = [
    ('entity_no_events', "Entità senza eventi recenti"),
    ('entity_stale', "Entità in stato da N giorni"),
    ('entity_missing_field', "Entità senza campo valorizzato"),
    ('sign_pending', "Firma in attesa da N giorni"),
    ('email_unread', "Email di progetto non letta da N giorni"),
    ('event_debrief_missing', "Evento senza debrief dopo N ore"),
]


class Erpv6SuggestionRule(models.Model):
    _name = 'erpv6.suggestion.rule'
    _description = 'Regola di generazione suggerimenti'
    _order = 'sequence, code'

    code = fields.Char(
        string='Codice', required=True, index=True,
        help="Identificatore stabile (usato anche nel body AI).")
    name = fields.Char(string='Nome', required=True)
    sequence = fields.Integer(string='Ordine', default=10)
    active = fields.Boolean(string='Attiva', default=True)
    priority = fields.Selection([
        ('low', 'Bassa'),
        ('normal', 'Normale'),
        ('high', 'Alta'),
    ], string='Priorità output', default='normal', required=True)

    matcher_type = fields.Selection(
        MATCHER_TYPES, string='Tipo di regola', required=True,
        help="Il 'motore' che esegue il match. Solo 6 tipi generici.")

    target_model = fields.Char(
        string='Modello target', required=True,
        help="es. 'erpv6.deal', 'erpv6.sign.request', 'erpv6.project.email.log'")

    filter_domain = fields.Text(
        string='Filtro extra (Odoo domain)',
        help="Lista Python, es. [('state','=','negotiating')]. "
             "Vuoto = nessun filtro.")

    # ── Parametri per entity_stale / entity_no_events / entity_missing_field
    stale_field = fields.Char(
        string='Campo data di riferimento',
        help="es. create_date, write_date. Per entity_stale/no_events.")
    stale_days = fields.Integer(
        string='Soglia (giorni)', default=15,
        help="Giorni oltre i quali scatta la regola.")
    stale_states = fields.Char(
        string='Stati target (CSV)',
        help="es. negotiating,forecasting. Vuoto = tutti gli stati.")
    watch_field = fields.Char(
        string='Campo da verificare',
        help="Per entity_missing_field: es. next_step_id.")

    # ── Parametri per sign_pending
    sign_states = fields.Char(
        string='Stati firma (CSV)', default='sent,viewed',
        help="Stati sign.request che scattano (default: sent,viewed).")
    sign_date_field = fields.Char(
        string='Campo data firma', default='sent_at',
        help="es. sent_at, viewed_at.")

    # ── Parametri per event_debrief_missing
    event_types = fields.Char(
        string='Tipi evento (CSV)', default='tavolo_incontro,call',
        help="Event_type che richiedono debrief.")
    debrief_hours = fields.Integer(
        string='Ore prima del sollecito', default=4)

    # ── Risoluzione destinatario
    user_resolver = fields.Char(
        string='Percorso proprietario',
        default='relation_id.owner_user_id',
        help="Percorso Python sul record per trovare l'utente. "
             "es. 'relation_id.owner_user_id'.")

    # ── Testo
    title_template = fields.Char(
        string='Titolo (template)', required=True,
        help="Placeholder {field} disponibili nel match.")
    body_fallback = fields.Text(
        string='Testo fallback',
        help="Testo statico se l'AI non risponde.")
    prompt_hint = fields.Text(
        string='Istruzioni aggiuntive per AI',
        help="Opzionale: contesto extra passato al prompt.")

    @api.model
    def _get_active_rules(self):
        return self.search([('active', '=', True)])
