# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging
import json

_logger = logging.getLogger(__name__)


class Erpv6BandoSource(models.Model):
    _name = 'erpv6.bando.source'
    _description = 'Fonte Scraping Bandi'
    _order = 'name'

    name = fields.Char(string='Nome Fonte', required=True)
    url = fields.Char(string='URL Base', required=True)
    source_type = fields.Selection([
        ('ministero', 'Ministero'),
        ('regione', 'Regione'),
        ('ue', 'Unione Europea'),
        ('invitalia', 'Invitalia'),
        ('custom', 'Custom'),
    ], string='Tipo Fonte', required=True)
    active = fields.Boolean(string='Attiva', default=True)
    last_scrape = fields.Datetime(string='Ultimo Scraping')
    scrape_interval_hours = fields.Integer(string='Intervallo Scraping (ore)', default=6)
    api_endpoint = fields.Char(string='API Endpoint')
    api_key = fields.Char(string='API Key')

    def _get_or_create_deep_source_config(self):
        """Recupera o crea una configurazione erpv6.deep.source.config per questa fonte."""
        self.ensure_one()
        
        # Cerca categoria KB 'bandi' o crea se non esiste
        kb_category = self.env['erpv6.kb.category'].search([
            ('name', '=ilike', '%bandi%')
        ], limit=1)
        
        if not kb_category:
            # Crea categoria bandi se non esiste
            kb_category = self.env['erpv6.kb.category'].create({
                'name': 'Bandi e Finanziamenti',
                'description': 'Categoria per bandi di finanziamento e agevolazioni',
            })
            _logger.info(f"Creata categoria KB per bandi: {kb_category.id}")
        
        # Schema di estrazione default per bandi
        extraction_schema = {
            "title": "string - Titolo del bando",
            "code": "string - Codice identificativo univoco",
            "ente": "string - Ente erogatore",
            "amount": "number - Importo massimo finanziabile",
            "deadline": "string - Data scadenza (ISO format)",
            "sectors": "array of strings - Settori target",
            "requirements": "string - Requisiti minimi",
            "description": "string - Descrizione completa",
            "type": "string - Tipo agevolazione (fondo_perduto, credito_imposta, etc.)"
        }
        
        # Cerca config esistente con lo stesso nome/url
        existing_config = self.env['erpv6.deep.source.config'].search([
            '|',
            ('name', '=', self.name),
            ('target_url_pattern', '=', self.url),
        ], limit=1)
        
        if existing_config:
            return existing_config
        
        # Crea nuova configurazione
        new_config = self.env['erpv6.deep.source.config'].create({
            'name': self.name,
            'source_type': 'scraper',
            'fetch_type': 'generic_scraper',
            'target_url_pattern': self.url,
            'kb_category_id': kb_category.id,
            'default_extraction_schema': extraction_schema,
            'is_active': True,
        })
        _logger.info(f"Creata configurazione deep source: {new_config.id} per {self.name}")
        
        return new_config

    def action_scrape_now(self):
        """Chiama erpv6_deep_source.engine per fare scraping e salvare in KB, poi crea record erpv6.bando"""
        self.ensure_one()
        
        # Recupera o crea configurazione deep source
        config = self._get_or_create_deep_source_config()
        
        # Chiama il motore di estrazione
        try:
            kb_record = self.env['erpv6.deep.source.engine'].search_and_extract(
                source_config_id=config.id,
                context_extra={'source_name': self.name},
            )
            
            # Dopo l'estrazione, parse dei risultati per creare record erpv6.bando
            # Il contenuto KB è JSON cifrato, decifralo se necessario
            content = kb_record.content
            if kb_record.is_encrypted:
                crypto = self.env['erpv6.crypto.engine']
                try:
                    content = crypto.decrypt(content, context=f"kb_create_{kb_record.kb_type}")
                except Exception as e:
                    _logger.warning(f"Impossibile decifrare contenuto KB {kb_record.id}: {e}")
            
            # Parse JSON
            try:
                extracted_data = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                extracted_data = []
            
            # Se è un singolo oggetto, convertilo in lista
            if isinstance(extracted_data, dict):
                extracted_data = [extracted_data]
            
            created_count = 0
            for item in extracted_data:
                if not isinstance(item, dict):
                    continue
                    
                code = item.get('code', f"UNKNOWN-{self.id}-{fields.Datetime.now()}")
                
                # Verifica se bando esiste già
                existing = self.env['erpv6.bando'].search([
                    ('code', '=', code)
                ], limit=1)
                
                if existing:
                    _logger.debug(f"Bando {code} già esistente, skip")
                    continue
                
                # Mappa i dati estratti sui campi erpv6.bando
                tipo_agevolazione_map = {
                    'fondo_perduto': 'fondo_perduto',
                    'credito_imposta': 'credito_imposta',
                    'finanziamento_agevolato': 'finanziamento_agevolato',
                    'grant': 'grant',
                }
                raw_type = str(item.get('type', 'misto')).lower()
                mapped_type = next((k for k, v in tipo_agevolazione_map.items() if k in raw_type), 'misto')
                
                self.env['erpv6.bando'].create({
                    'name': item.get('title', 'Senza titolo'),
                    'code': code,
                    'ente': item.get('ente', self.name),
                    'importo_max': float(item.get('amount', 0.0) or 0.0),
                    'scadenza_domanda': item.get('deadline'),
                    'settori_target': ','.join(item.get('sectors', [])) if isinstance(item.get('sectors'), list) else str(item.get('sectors', '')),
                    'descrizione': item.get('description', ''),
                    'requisiti_minimi': item.get('requirements', ''),
                    'source_id': self.id,
                    'tipo_agevolazione': mapped_type,
                    'status': 'draft',
                })
                created_count += 1
            
            self.last_scrape = fields.Datetime.now()
            _logger.info(f"Scraping completato per {self.name}: {created_count} nuovi bandi creati da KB {kb_record.id}")
            
        except Exception as e:
            _logger.error(f"Errore scraping {self.name}: {str(e)}")
            raise UserError(_('Errore durante lo scraping: %s') % str(e))
        
        return True

    @api.model
    def _cron_scrape_all(self):
        """Cron job che fa scraping di tutte le fonti attive"""
        sources = self.search([('active', '=', True)])
        _logger.info(f"Cron scraping bandi: {len(sources)} fonti attive")

        for source in sources:
            try:
                source.action_scrape_now()
            except Exception as e:
                _logger.error(f"Errore cron scraping {source.name}: {str(e)}")

        return True
