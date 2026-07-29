# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
import logging
import json
from datetime import datetime

_logger = logging.getLogger(__name__)


class Erpv6Bando(models.Model):
    _name = 'erpv6.bando'
    _description = 'Bando di Finanziamento'
    _order = 'scadenza_domanda DESC'
    _inherit = ['erpv6.core.tracked']

    name = fields.Char(string='Nome Bando', required=True)
    code = fields.Char(string='Codice Univoco', required=True, copy=False)
    source_id = fields.Many2one('erpv6.bando.source', string='Fonte')
    ente = fields.Char(string='Ente Erogatore')
    descrizione = fields.Html(string='Descrizione')
    importo_max = fields.Monetary(string='Importo Massimo', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    percent_max = fields.Float(string='Percentuale Max', help='Percentuale massima finanziabile')
    tipo_agevolazione = fields.Selection([
        ('fondo_perduto', 'Fondo Perduto'),
        ('credito_imposta', 'Credito d\'Imposta'),
        ('finanziamento_agevolato', 'Finanziamento Agevolato'),
        ('grant', 'Grant'),
        ('misto', 'Misto'),
    ], string='Tipo Agevolazione', required=True)
    scadenza_domanda = fields.Date(string='Scadenza Domanda')
    scadenza_erogazione = fields.Date(string='Scadenza Erogazione')
    settori_target = fields.Char(string='Settori Target', help='Separati da virgola')
    requisiti_minimi = fields.Html(string='Requisiti Minimi')
    requisiti_esclusivi = fields.Html(string='Requisiti Esclusivi')
    area_geografica = fields.Selection([
        ('nazionale', 'Nazionale'),
        ('regionale', 'Regionale'),
        ('europa', 'Europa'),
        ('mondiale', 'Mondiale'),
    ], string='Area Geografica', default='nazionale')
    regione = fields.Char(string='Regione')
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('active', 'Attivo'),
        ('expired', 'Scaduto'),
        ('closed', 'Chiuso'),
    ], string='Stato', default='draft', tracking=True)
    match_count = fields.Integer(string='Numero Match', compute='_compute_match_count')
    application_count = fields.Integer(string='Numero Candidature', compute='_compute_application_count')
    kb_module_id = fields.Char(string='ID Modulo KB')
    last_sync = fields.Datetime(string='Ultima Sincronizzazione')

    _sql_constraints = [
        ('code_uniq', 'unique (code)', 'Il codice del bando deve essere univoco!')
    ]

    @api.depends('match_ids')
    def _compute_match_count(self):
        for record in self:
            record.match_count = len(record.match_ids)

    @api.depends('application_ids')
    def _compute_application_count(self):
        for record in self:
            record.application_count = len(record.application_ids)

    match_ids = fields.One2many('erpv6.bando.match', 'bando_id', string='Match')
    application_ids = fields.One2many('erpv6.bando.application', 'bando_id', string='Candidature')

    def action_search_updates(self):
        """Chiama erpv6_deep_source per verificare aggiornamenti"""
        self.ensure_one()
        if not self.source_id:
            raise UserError(_('Nessuna fonte configurata per questo bando'))
        
        return self.source_id.action_scrape_now()

    def action_validate(self):
        """Valida bando e salva in KB cifrata"""
        self.ensure_one()
        
        # Prepara contenuto per KB
        kb_content = {
            'code': self.code,
            'name': self.name,
            'ente': self.ente,
            'importo_max': self.importo_max,
            'scadenza': self.scadenza_domanda.isoformat() if self.scadenza_domanda else None,
            'settori': self.settori_target.split(',') if self.settori_target else [],
            'requisiti': self.requisiti_minimi,
            'tipo_agevolazione': self.tipo_agevolazione,
        }
        
        # Salva in KB (cifrato)
        try:
            kb_module = self.env['erpv6.kb.module'].create({
                'module_id': f"bando-{self.code}",
                'category': 'bandi',
                'content': json.dumps(kb_content),
                'encrypted': True,
                'version': '1.0',
            })
            
            self.kb_module_id = kb_module.id
            self.status = 'active'
            _logger.info(f"Bando {self.code} validato e salvato in KB")
        except Exception as e:
            _logger.error(f"Errore durante il salvataggio in KB: {str(e)}")
            raise UserError(_('Errore durante il salvataggio in KB: %s') % str(e))
        
        return True

    def action_expire(self):
        """Segna come scaduto"""
        self.ensure_one()
        if self.scadenza_domanda and self.scadenza_domanda < fields.Date.today():
            self.status = 'expired'
            _logger.info(f"Bando {self.code} segnato come scaduto")
        return True

    def action_open_matches(self):
        """Apre la vista dei match"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Match Clienti'),
            'res_model': 'erpv6.bando.match',
            'view_mode': 'tree,form',
            'domain': [('bando_id', '=', self.id)],
            'context': {'default_bando_id': self.id},
        }

    def action_open_applications(self):
        """Apre la vista delle candidature"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Candidature'),
            'res_model': 'erpv6.bando.application',
            'view_mode': 'tree,form',
            'domain': [('bando_id', '=', self.id)],
            'context': {'default_bando_id': self.id},
        }
