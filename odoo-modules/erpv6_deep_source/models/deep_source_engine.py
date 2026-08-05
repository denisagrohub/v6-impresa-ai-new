# -*- coding: utf-8 -*-
from odoo import models, api, fields, _
import requests
import json
import logging
import time

_logger = logging.getLogger(__name__)


class Erpv6DeepSourceEngine(models.AbstractModel):
    _name = 'erpv6.deep.source.engine'
    _description = 'Motore di Estrazione Deep Source (non persistente)'

    def _fetch_from_official_api(self, config, context_extra=None):
        """
        Dispatcher per chiamate API ufficiali.
        Implementa le chiamate specifiche in base a fetch_type.
        """
        fetch_type = config.fetch_type
        
        if fetch_type == 'google_trends':
            return self._fetch_google_trends(config, context_extra)
        elif fetch_type == 'amazon':
            return self._fetch_amazon(config, context_extra)
        else:
            raise NotImplementedError(
                f"API '{fetch_type}' non implementata. "
                "Richiede librerie/credenziali specifiche non disponibili. "
                "Implementare il metodo _fetch_{fetch_type} con endpoint e autenticazione corretti."
            )

    def _fetch_google_trends(self, config, context_extra=None):
        """
        Stub per Google Trends API.
        TODO: Implementare con libreria pytrends o API ufficiale Google Trends.
        Richiede credenziali Google Cloud e configurazione specifica.
        """
        raise NotImplementedError(
            "Google Trends API non implementata. "
            "Richiede: 1) Libreria pytrends o accesso API Google Trends, "
            "2) Credenziali Google Cloud configurate in api_credentials, "
            "3) Endpoint/API specifici da definire."
        )

    def _fetch_amazon(self, config, context_extra=None):
        """
        Stub per Amazon Product Advertising API.
        TODO: Implementare con Amazon PA-API 5.0.
        Richiede: Associate Tag, Access Key, Secret Key, regione marketplace.
        """
        raise NotImplementedError(
            "Amazon Product API non implementata. "
            "Richiede: 1) Account Amazon Associates attivo, "
            "2) Credenziali PA-API (AccessKey, SecretKey, AssociateTag), "
            "3) Regione marketplace specificata, "
            "4) Libreria python-amazon-paapi o implementazione REST diretta."
        )

    def _call_scraper_service(self, url, wait_for='networkidle', timeout_ms=15000):
        """
        Chiama il microservizio scraper via HTTP POST.
        Gestisce retry singolo in caso di errore di rete.
        """
        scraper_url = self.env['ir.config_parameter'].sudo().get_param(
            'deep_source.scraper_url',
            default='http://scraper:8090/render'
        )
        
        payload = {
            'url': url,
            'wait_for': wait_for,
            'timeout_ms': timeout_ms,
        }
        
        max_retries = 2
        last_error = None
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    scraper_url,
                    json=payload,
                    headers={'Content-Type': 'application/json'},
                    timeout=timeout_ms / 1000 + 5,
                )
                response.raise_for_status()
                result = response.json()
                
                if 'error' in result:
                    raise Exception(f"Scraper error: {result['error']}")
                
                return result.get('html', '')
                
            except requests.exceptions.RequestException as e:
                last_error = str(e)
                _logger.warning(f"Scraper call attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # Attendi 1 secondo prima del retry
                continue
            except Exception as e:
                last_error = str(e)
                _logger.error(f"Scraper error: {e}")
                raise
        
        raise Exception(f"Scraper service unavailable after {max_retries} attempts: {last_error}")

    def _save_to_kb(self, extracted_data, config, source_identifier):
        """
        Salva i dati estratti in erpv6.kb, creando o aggiornando un record esistente.
        """
        kb_model = self.env['erpv6.kb']
        
        # Determina kb_type in base alla categoria
        # Verifica i kb_type esistenti in erpv6_kb/models/kb_knowledge.py
        # Usiamo 'document' come default se non troviamo una corrispondenza specifica
        kb_type = 'document'  # Default, da adattare in base alla categoria
        
        # Cerca record esistente con stesso source e category
        existing_kb = kb_model.search([
            ('source', '=', source_identifier),
            ('category_id', '=', config.kb_category_id.id),
        ], limit=1)
        
        content_json = json.dumps(extracted_data, ensure_ascii=False, indent=2)
        
        if existing_kb:
            # Aggiorna contenuto (triggera versionamento tramite erpv6.version.mixin)
            existing_kb.write({
                'content': content_json,
                'is_encrypted': True,
            })
            _logger.info(f"Updated KB record {existing_kb.id} for source {source_identifier}")
            return existing_kb
        else:
            # Crea nuovo record
            new_kb = kb_model.create({
                'kb_type': kb_type,
                'category_id': config.kb_category_id.id,
                'source': source_identifier,
                'content': content_json,
                'is_encrypted': True,
            })
            _logger.info(f"Created KB record {new_kb.id} for source {source_identifier}")
            return new_kb

    def search_and_extract(self, source_config_id, context_extra=None, extraction_schema_override=None):
        """
        Metodo principale per cercare ed estrarre dati da una fonte configurata.
        
        :param source_config_id: ID di erpv6.deep.source.config
        :param context_extra: Dict con parametri aggiuntivi per la chiamata
        :param extraction_schema_override: Schema JSON di estrazione override
        :return: Record erpv6.kb creato/aggiornato
        """
        config = self.env['erpv6.deep.source.config'].browse(source_config_id)
        if not config.exists():
            raise ValueError(f"Configurazione deep source {source_config_id} non trovata")
        
        if not config.is_active:
            raise ValueError(f"Configurazione {config.name} non è attiva")
        
        # Ottieni schema di estrazione
        extraction_schema = extraction_schema_override or config.default_extraction_schema
        if not extraction_schema:
            raise ValueError("Nessuno schema di estrazione fornito")
        
        raw_content = None
        source_identifier = None
        
        # Recupera contenuti grezzi in base al tipo di fonte
        if config.source_type == 'scraper':
            if not config.target_url_pattern:
                raise ValueError("target_url_pattern richiesto per source_type='scraper'")
            
            # Formatta URL con eventuali parametri da context_extra
            url = config.target_url_pattern
            if context_extra:
                try:
                    url = url.format(**context_extra)
                except KeyError:
                    pass  # Usa URL così com'è
            
            source_identifier = url
            _logger.info(f"Calling scraper for URL: {url}")
            raw_content = self._call_scraper_service(url)
            
        elif config.source_type == 'api':
            source_identifier = f"api:{config.fetch_type}:{config.name}"
            _logger.info(f"Fetching from official API: {config.fetch_type}")
            raw_content = self._fetch_from_official_api(config, context_extra)
        else:
            raise ValueError(f"source_type non valido: {config.source_type}")
        
        if not raw_content:
            raise ValueError("Nessun contenuto ottenuto dalla fonte")
        
        # Chiama AI bridge per estrazione strutturata
        omni_bridge = self.env['erpv6.omni.bridge']
        
        ai_payload = {
            'raw_content': raw_content,
            'extraction_schema': extraction_schema,
            'source_type': config.source_type,
            'fetch_type': config.fetch_type,
        }
        
        ai_context = {
            'source_config_id': config.id,
            'source_name': config.name,
        }
        if context_extra:
            ai_context.update(context_extra)
        
        _logger.info(f"Calling AI bridge for extraction with task_type='deep_source_extraction'")
        
        ai_result = omni_bridge.execute_ai_task(
            task_type='deep_source_extraction',
            payload=ai_payload,
            context=ai_context,
        )
        
        # Parse risultato AI (atteso JSON)
        if isinstance(ai_result, str):
            try:
                extracted_data = json.loads(ai_result)
            except json.JSONDecodeError:
                extracted_data = {'raw_response': ai_result}
        else:
            extracted_data = ai_result
        
        # Salva in KB
        kb_record = self._save_to_kb(extracted_data, config, source_identifier)
        
        return kb_record
