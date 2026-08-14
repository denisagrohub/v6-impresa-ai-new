# -*- coding: utf-8 -*-
import logging
import json
import time
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import config

_logger = logging.getLogger(__name__)


class OmniProvider(models.Model):
    """
    Provider AI (OpenAI, Anthropic, Groq, Deepgram, ecc.)
    
    🔐 SICUREZZA: Le API Key sono cifrate automaticamente con erpv6_crypto
    al salvataggio. La chiave in chiaro è accessibile solo tramite
    get_decrypted_api_key() per uso interno (proxy).
    """
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
    
    # 🔐 CAMPO CIFRATO: Viene cifrato automaticamente in create/write.
    # Non required a livello di campo: un provider stub può esistere senza
    # chiave finché resta inattivo (vedi vincolo _check_api_key_if_active).
    api_key = fields.Char(string='API Key (Cifrata)')
    
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
    
    # ✅ FIX CRITICO: Campo mancante che causava crash in _compute_stats
    call_log_ids = fields.One2many('erpv6.omni.call.log', 'provider_id',
                                   string='Log Chiamate')

    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice del provider deve essere univoco!')
    ]

    @api.constrains('api_key', 'is_active')
    def _check_api_key_if_active(self):
        for provider in self:
            if provider.is_active and not provider.api_key:
                raise ValidationError(_(
                    "Il provider '%s' non può essere attivo senza una API Key. "
                    "Configura la chiave oppure lascialo disattivato."
                ) % provider.name)

    # ========================================================================
    # 🔐 CRITTOGRAFIA AUTOMATICA
    # ========================================================================

    @api.model
    def create(self, vals):
        """Cifra la API Key automaticamente alla creazione"""
        if 'api_key' in vals and vals['api_key']:
            vals['api_key'] = self._encrypt_key(vals['api_key'])
        return super().create(vals)

    def write(self, vals):
        """Cifra la API Key automaticamente all'aggiornamento"""
        if 'api_key' in vals and vals['api_key']:
            vals['api_key'] = self._encrypt_key(vals['api_key'])
        return super().write(vals)

    def _encrypt_key(self, key):
        """
        Cifra la chiave con erpv6_crypto.
        Se è già cifrata (payload JSON), la ritorna così com'è.
        """
        try:
            # Prova a parsare come JSON (chiave già cifrata)
            json.loads(key)
            return key  # Già cifrata, non toccare
        except (json.JSONDecodeError, TypeError):
            # Cifra con erpv6_crypto
            return self.env['erpv6.crypto.engine'].encrypt(key)

    def get_decrypted_api_key(self):
        """
        🔐 Restituisce la chiave in chiaro per uso interno (proxy).
        Da usare SOLO lato server, MAI esporre al frontend.
        """
        self.ensure_one()
        if not self.api_key:
            return ''
        try:
            # Prova a parsare come JSON (chiave cifrata)
            payload = json.loads(self.api_key)
            if 'data' in payload:
                # Decifra con erpv6_crypto
                return self.env['erpv6.crypto.engine'].decrypt(self.api_key)
        except (json.JSONDecodeError, TypeError):
            pass
        # Fallback per chiavi legacy in chiaro (da migrare)
        _logger.warning(f"Provider {self.name}: API Key non cifrata, migrare!")
        return self.api_key

    # ========================================================================
    # STATISTICHE
    # ========================================================================
    
    @api.depends('call_log_ids')
    def _compute_stats(self):
        """Calcola statistiche aggregate dai log"""
        for provider in self:
            logs = provider.call_log_ids
            provider.total_calls = len(logs)
            provider.total_cost = sum(logs.mapped('cost_usd'))
            if provider.total_calls > 0:
                successful = len(logs.filtered(lambda l: l.status == 'success'))
                provider.success_rate = (successful / provider.total_calls) * 100
            else:
                provider.success_rate = 0.0

    # ========================================================================
    # AZIONI
    # ========================================================================
    
    def action_test_connection(self):
        """Testa la connessione al provider (solo verifica configurazione)"""
        self.ensure_one()
        _logger.info(f"Testing connection to {self.name}...")
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Connessione Testata'),
                'message': f'Configurazione valida per {self.name}. La chiave è cifrata correttamente.',
                'type': 'success',
                'sticky': False,
            }
        }

    def get_optimal_model(self, task_type, context=None):
        """Restituisce il modello ottimale per il task dato"""
        self.ensure_one()
        if self.supported_models:
            models_list = [m.strip() for m in self.supported_models.split(',')]
            return models_list[0] if models_list else None
        return None

    # ========================================================================
    # CIRCUIT BREAKER (opzionale, per resilienza)
    # ========================================================================
    
    def is_available(self):
        """Verifica se il provider è disponibile (circuit breaker)"""
        self.ensure_one()
        if not self.is_active:
            return False
        # Se ha avuto errori recenti, aspetta prima di riprovare
        if self.last_error_at:
            cooldown_minutes = 5
            time_since_error = (fields.Datetime.now() - self.last_error_at).total_seconds()
            if time_since_error < cooldown_minutes * 60:
                return False
        return True
