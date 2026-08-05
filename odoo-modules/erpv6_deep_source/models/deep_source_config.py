# -*- coding: utf-8 -*-
from odoo import models, fields, api
import json
import logging

_logger = logging.getLogger(__name__)


class Erpv6DeepSourceConfig(models.Model):
    _name = 'erpv6.deep.source.config'
    _description = 'Configurazione Fonte Esterna per Deep Source'
    _order = 'name'

    name = fields.Char(string='Nome', required=True)
    source_type = fields.Selection([
        ('api', 'API Ufficiale'),
        ('scraper', 'Scraping via Browser Headless')
    ], string='Tipo Fonte', required=True)
    fetch_type = fields.Selection([
        ('google_trends', 'Google Trends'),
        ('amazon', 'Amazon Product API'),
        ('generic_scraper', 'Scraping Generico')
    ], string='Tipo Fetch', required=True)
    target_url_pattern = fields.Char(string='URL/Pattern Target')
    api_credentials = fields.Char(string='Credenziali API (cifrate)')
    kb_category_id = fields.Many2one('erpv6.kb.category', string='Categoria KB', required=True)
    default_extraction_schema = fields.Json(string='Schema Estrazione Default')
    is_active = fields.Boolean(string='Attivo', default=True)
    last_run = fields.Datetime(string='Ultima Esecuzione', readonly=True)
    last_run_status = fields.Selection([
        ('success', 'Successo'),
        ('error', 'Errore')
    ], string='Stato Ultima Esecuzione', readonly=True)
    last_run_error = fields.Text(string='Errore Ultima Esecuzione', readonly=True)

    def _encrypt_key(self, key_value):
        """Cifra la chiave se non è già cifrata (JSON)."""
        if not key_value:
            return key_value
        try:
            # Verifica se è già un JSON cifrato
            parsed = json.loads(key_value)
            if isinstance(parsed, dict) and 'encrypted' in parsed:
                return key_value  # Già cifrato
        except (json.JSONDecodeError, TypeError):
            pass
        # Cifra la chiave
        crypto_engine = self.env['erpv6.crypto.engine']
        encrypted = crypto_engine.encrypt(key_value)
        return json.dumps({'encrypted': encrypted})

    def get_decrypted_credentials(self):
        """Decifra le credenziali per l'uso interno."""
        if not self.api_credentials:
            return None
        try:
            parsed = json.loads(self.api_credentials)
            if isinstance(parsed, dict) and 'encrypted' in parsed:
                crypto_engine = self.env['erpv6.crypto.engine']
                return crypto_engine.decrypt(parsed['encrypted'])
        except (json.JSONDecodeError, TypeError, Exception):
            pass
        return self.api_credentials

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('api_credentials'):
                vals['api_credentials'] = self._encrypt_key(vals['api_credentials'])
        return super().create(vals_list)

    def write(self, vals):
        if vals.get('api_credentials'):
            vals['api_credentials'] = self._encrypt_key(vals['api_credentials'])
        return super().write(vals)

    def action_execute_now(self):
        """Esegue manualmente l'estrazione da questa fonte."""
        self.ensure_one()
        engine = self.env['erpv6.deep.source.engine']
        try:
            result = engine.search_and_extract(self.id)
            self.write({
                'last_run': fields.Datetime.now(),
                'last_run_status': 'success',
                'last_run_error': False,
            })
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Esecuzione Completata',
                    'message': 'Estrazione dati completata con successo.',
                    'type': 'success',
                    'sticky': False,
                }
            }
        except Exception as e:
            self.write({
                'last_run': fields.Datetime.now(),
                'last_run_status': 'error',
                'last_run_error': str(e),
            })
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Errore Esecuzione',
                    'message': f'Errore durante l\'estrazione: {str(e)}',
                    'type': 'danger',
                    'sticky': True,
                }
            }
