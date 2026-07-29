# -*- coding: utf-8 -*-
import logging
import json
import time
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import config

_logger = logging.getLogger(__name__)

class OmniProvider(models.Model):
    _name = 'erpv6.omni.provider'
    _description = 'Provider AI (OpenAI, Anthropic, Groq, Deepgram, ecc.)'
    _order = 'priority asc, name'

    name = fields.Char(string='Nome Provider', required=True)
    code = fields.Char(string='Codice', required=True, unique=True)
    provider_type = fields.Selection([
        ('llm', 'LLM (Chat/Completion)'),
        ('transcription', 'Trascrizione Audio/Video'),
        ('embedding', 'Embedding'),
        ('image', 'Generazione Immagini'),
        ('speech', 'Text-to-Speech'),
    ], string='Tipo', required=True, default='llm')
    
    api_key = fields.Char(string='API Key', required=True)
    api_url = fields.Char(string='API URL Base', required=True)
    api_version = fields.Char(string='Versione API')
    
    # Configurazione routing
    priority = fields.Integer(string='Priorità', default=10, 
                              help="Priorità più bassa = maggiore priorità")
    is_active = fields.Boolean(string='Attivo', default=True)
    max_rpm = fields.Integer(string='Max Richieste/Minuto', default=60)
    timeout_seconds = fields.Integer(string='Timeout (s)', default=30)
    
    # Costi e monitoraggio
    cost_per_1k_input = fields.Float(string='Costo / 1K token input ($)', default=0.0)
    cost_per_1k_output = fields.Float(string='Costo / 1K token output ($)', default=0.0)
    total_calls = fields.Integer(string='Chiamate Totali', compute='_compute_stats')
    total_cost = fields.Float(string='Costo Totale ($)', compute='_compute_stats')
    success_rate = fields.Float(string='Tasso Successo (%)', compute='_compute_stats')
    
    last_error = fields.Text(string='Ultimo Errore', readonly=True)
    last_error_at = fields.Datetime(string='Data Ultimo Errore', readonly=True)
    
    # Metadati
    supported_models = fields.Text(string='Modelli Supportati', 
                                   help="Lista modelli separati da virgola")
    metadata = fields.Json(string='Metadati Extra')

    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice del provider deve essere univoco!')
    ]

    @api.depends('call_log_ids')
    def _compute_stats(self):
        for provider in self:
            logs = provider.call_log_ids
            provider.total_calls = len(logs)
            provider.total_cost = sum(logs.mapped('cost_usd'))
            if provider.total_calls > 0:
                successful = len(logs.filtered(lambda l: l.status == 'success'))
                provider.success_rate = (successful / provider.total_calls) * 100
            else:
                provider.success_rate = 0.0

    call_log_ids = fields.One2many('erpv6.omni.call.log', 'provider_id', string='Log Chiamate')

    def action_test_connection(self):
        """Testa la connessione al provider"""
        self.ensure_one()
        # Implementazione reale chiamerà API di test
        _logger.info(f"Testing connection to {self.name}...")
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Connessione Testata'),
                'message': f'Connessione a {self.name} funzionante!',
                'type': 'success',
                'sticky': False,
            }
        }

    def get_optimal_model(self, task_type, context=None):
        """Restituisce il modello ottimale per il task dato"""
        self.ensure_one()
        # Logica di selezione modello basata su task_type
        # Può essere estesa con regole specifiche
        if self.supported_models:
            models_list = [m.strip() for m in self.supported_models.split(',')]
            return models_list[0] if models_list else None
        return None
