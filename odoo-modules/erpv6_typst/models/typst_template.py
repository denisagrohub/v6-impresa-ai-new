# -*- coding: utf-8 -*-

import logging
from odoo import models, fields, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class TypstTemplate(models.Model):
    """
    Modello per gestire i template Tipst (.typ)

    Il sorgente .typ e' salvato direttamente sul record (campo
    `typst_source`), non tramite erpv6_kb: non e' "conoscenza" che un'AI deve
    consultare (regole fiscali/psicologiche/normative), e' codice di layout
    versionato come qualsiasi altro asset del modulo.

    Convenzione dati: il sorgente .typ deve leggere i dati di rendering con
    `#let data = json("data.json")` (funzione nativa di Typst) - il motore
    (erpv6.typst.document._generate_pdf_with_typst) scrive quel file accanto
    al sorgente prima di compilare. Struttura di `data` = i campi elencati in
    `required_fields` per quel template.
    """
    _name = 'erpv6.typst.template'
    _description = 'Template Tipst per generazione documenti'
    _order = 'category, sequence, name'

    name = fields.Char(string='Nome Template', required=True)
    code = fields.Char(string='Codice Univoco', required=True, index=True)
    category = fields.Selection([
        ('business_plan', 'Business Plan'),
        ('financial_report', 'Report Finanziario'),
        ('bando_application', 'Candidatura Bando'),
        ('proposal', 'Proposta Commerciale'),
        ('contract', 'Contratto'),
        ('custom', 'Personalizzato'),
    ], string='Categoria', required=True, default='business_plan')

    sequence = fields.Integer(string='Sequenza', default=10)
    description = fields.Text(string='Descrizione')

    # Sorgente Typst (.typ) del template
    typst_source = fields.Text(string='Sorgente Typst (.typ)')

    # Metadati del template
    version = fields.Char(string='Versione', default='1.0')
    language = fields.Selection([
        ('it', 'Italiano'),
        ('en', 'English'),
        ('de', 'Deutsch'),
        ('fr', 'Français'),
    ], string='Lingua', default='it')
    
    # Campi richiesti dal template (JSON schema)
    required_fields = fields.Json(string='Campi Richiesti (JSON Schema)')
    
    # Configurazione rendering
    page_size = fields.Selection([
        ('a4', 'A4'),
        ('a3', 'A3'),
        ('letter', 'Letter'),
        ('legal', 'Legal'),
    ], string='Formato Pagina', default='a4')
    
    orientation = fields.Selection([
        ('portrait', 'Verticale'),
        ('landscape', 'Orizzontale'),
    ], string='Orientamento', default='portrait')
    
    active = fields.Boolean(string='Attivo', default=True)
    
    # Statistiche
    usage_count = fields.Integer(string='Utilizzi', compute='_compute_usage_count')
    last_used = fields.Datetime(string='Ultimo Utilizzo', compute='_compute_usage_count')
    
    _sql_constraints = [
        ('code_unique', 'UNIQUE(code)', 'Il codice del template deve essere univoco!'),
    ]

    @api.depends()
    def _compute_usage_count(self):
        Document = self.env['erpv6.typst.document']
        for template in self:
            docs = Document.search([('template_id', '=', template.id)], order='created_at desc', limit=1)
            template.usage_count = len(Document.search([('template_id', '=', template.id)]))
            template.last_used = docs.created_at if docs else False

    def action_preview_source(self):
        """Mostra il sorgente .typ del template (solo per admin)"""
        self.ensure_one()
        if not self.typst_source:
            raise UserError(_("Nessun sorgente Typst configurato per questo template."))

        return {
            'type': 'ir.actions.client',
            'tag': 'display_text',
            'params': {
                'title': f"Anteprima Template: {self.name}",
                'content': self.typst_source,
            }
        }

    def get_typst_source(self):
        """Ottiene il sorgente .typ (usato dal motore di rendering)"""
        self.ensure_one()
        if not self.typst_source:
            raise UserError(_("Template non configurato: manca il sorgente Typst (%s).") % self.name)

        return self.typst_source

    def action_use(self):
        """Registra un utilizzo del template.

        Nessuno stato da scrivere: usage_count/last_used sono gia' calcolati
        automaticamente da _compute_usage_count a partire dai documenti
        collegati esistenti."""
        self.ensure_one()
        return True
