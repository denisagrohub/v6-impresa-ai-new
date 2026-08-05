# -*- coding: utf-8 -*-
import logging
import time
import requests
import json
from odoo import models, api, fields, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6OmniBridge(models.AbstractModel):
    """
    Modello wrapper per eseguire task AI tramite OmniRoute.
    
    Questo modello espone il metodo execute_ai_task() che può essere chiamato
    internamente da altri moduli Odoo (es. erpv6_package, erpv6_deep_source, ecc.)
    per eseguire task AI configurati tramite erpv6.omni.route.config.
    
    FLUSSO:
    1. Il modulo chiamante invia task_type + payload
    2. Questo modello cerca la route configurata
    3. Recupera il provider primario (e fallback)
    4. Decifra la API Key tramite erpv6_crypto
    5. Chiama il provider AI esterno
    6. Se fallisce, prova il fallback
    7. Registra il log (costo, durata, errore)
    8. Restituisce la risposta al chiamante
    """
    _name = 'erpv6.omni.bridge'
    _description = 'Ponte OmniRoute per esecuzione task AI interni'

    def execute_ai_task(self, task_type, payload=None, prompt=None, context=None):
        """
        Esegue un task AI tramite il sistema OmniRoute.
        
        :param task_type: Tipo di task (es. 'chat_general', 'transcription', 'package_metadata_generation')
        :param payload: Dizionario con i dati per il provider (es. {'messages': [...], 'model': 'gpt-4'})
        :param prompt: Stringa prompt alternativa (verrà convertita in payload se payload è None)
        :param context: Info extra per il logging (partner_id, project_id, session_id, ecc.)
        :return: Dizionario con la risposta del provider AI
        """
        self.ensure_one()
        
        if context is None:
            context = {}
        
        # Se viene passato solo prompt, costruisci il payload standard per chat
        if payload is None and prompt:
            payload = {
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                'model': 'gpt-4-turbo',  # Default, verrà sovrascritto dal provider
                'temperature': 0.7,
            }
        elif payload is None:
            raise UserError(_("Deve essere fornito almeno 'payload' o 'prompt'"))
        
        # 1. Trova la configurazione di routing per questo task
        route = self.env['erpv6.omni.route.config'].sudo().search([
            ('task_type', '=', task_type),
            ('is_active', '=', True)
        ], limit=1, order='priority asc')
        
        if not route:
            return {
                'success': False,
                'error': f'Nessuna route configurata per il task: {task_type}'
            }
        
        # 2. Lista dei provider da tentare (Primario + Fallbacks)
        providers_to_try = [route.primary_provider_id] + list(route.fallback_provider_ids)
        providers_to_try = [p for p in providers_to_try if p]  # Rimuovi None
        
        attempted_providers = []
        last_error = None
        
        # 3. Ciclo di tentativo con Fallback
        for provider in providers_to_try:
            # Verifica circuit breaker
            if not provider.is_available():
                _logger.info(f"Provider {provider.name} non disponibile (circuit breaker)")
                continue
            
            attempted_providers.append(provider.id)
            start_time = time.time()
            
            try:
                # 🔐 RECUPERO CHIAVE CIFRATA E DECIFRATA
                api_key = provider.get_decrypted_api_key()
                if not api_key:
                    raise UserError(f"API Key mancante o non decifrabile per {provider.name}")
                
                # Costruisci l'URL e gli Header
                if provider.provider_type == 'llm':
                    url = f"{provider.api_url}/chat/completions"
                elif provider.provider_type == 'transcription':
                    url = f"{provider.api_url}/v1/transcribe"
                else:
                    url = f"{provider.api_url}/chat/completions"
                
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                }
                
                # Esegui la chiamata HTTP reale
                response = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=provider.timeout_seconds or 30
                )
                response.raise_for_status()  # Lancia eccezione se 4xx o 5xx
                
                result_data = response.json()
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Calcolo costi (semplificato, da adattare in base al provider)
                usage = result_data.get('usage', {})
                input_tokens = usage.get('prompt_tokens', 0)
                output_tokens = usage.get('completion_tokens', 0)
                cost = ((input_tokens / 1000) * provider.cost_per_1k_input) + \
                       ((output_tokens / 1000) * provider.cost_per_1k_output)
                
                # ✅ Log di successo
                call_log = self.env['erpv6.omni.call.log'].sudo().create_log(
                    task_type=task_type,
                    provider=provider,
                    model=payload.get('model', 'unknown'),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    status='success',
                    duration=duration_ms,
                    **(context or {})
                )
                
                # Resetta gli errori del provider
                provider.write({
                    'last_error': '',
                    'last_error_at': False
                })
                
                return {
                    'success': True,
                    'data': result_data,
                    'call_log_id': call_log.id,
                    'provider_used': provider.name,
                    'cost_usd': cost,
                    'duration_ms': duration_ms
                }
            
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                last_error = str(e)
                _logger.warning(f"Provider {provider.name} fallito per {task_type}: {last_error}")
                
                # ✅ Log di errore
                self.env['erpv6.omni.call.log'].sudo().create_log(
                    task_type=task_type,
                    provider=provider,
                    model=payload.get('model', 'unknown'),
                    input_tokens=0,
                    output_tokens=0,
                    cost=0.0,
                    status='error',
                    duration=duration_ms,
                    error_msg=last_error,
                    **(context or {})
                )
                
                # Aggiorna stato errore sul provider
                provider.write({
                    'last_error': last_error,
                    'last_error_at': fields.Datetime.now()
                })
                
                # Se abbiamo raggiunto il max dei tentativi, esci
                if len(attempted_providers) >= route.max_retries:
                    break
        
        # 4. Se arriviamo qui, tutti i provider sono falliti
        return {
            'success': False,
            'error': f'Tutti i provider hanno fallito. Ultimo errore: {last_error}',
            'attempted_providers': [p.name for p in providers_to_try
                                   if p.id in attempted_providers]
        }
