# -*- coding: utf-8 -*-
import logging
import json
import time
import requests
from odoo import http, fields
from odoo.http import request, Response
from odoo.exceptions import AccessDenied, UserError

_logger = logging.getLogger(__name__)


class OmniRouteAPI(http.Controller):
    """
    🔐 API JSON-RPC per il routing e l'esecuzione delle chiamate AI.
    
    PATTERN OMNIROUTE:
    - Il frontend Next.js NON vede mai le API Key
    - Next.js chiama /api/v6/omni/execute con il payload
    - Odoo recupera la chiave cifrata, la decifra, chiama il provider
    - Odoo registra il log e restituisce solo la risposta al frontend
    """

    # ========================================================================
    # CONFIGURAZIONE (solo metadati, NO API Key)
    # ========================================================================
    
    @http.route('/api/v6/omni/route', type='json', auth='user', csrf=False)
    def get_route_config(self, task_type, context=None):
        """
        Restituisce la configurazione di routing SENZA esporre le API Key.
        Usato dal frontend per sapere quale provider usare.
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
            
        route = request.env['erpv6.omni.route.config'].sudo().search([
            ('task_type', '=', task_type),
            ('is_active', '=', True)
        ], limit=1, order='priority asc')
        
        if not route:
            return {
                'task_type': task_type,
                'primary_provider': None,
                'fallback_providers': [],
                'strategy': 'priority',
                'max_retries': 3,
            }
            
        primary = route.primary_provider_id
        fallbacks = route.fallback_provider_ids
        
        return {
            'task_type': task_type,
            'primary_provider': {
                'id': primary.id,
                'code': primary.code,
                'api_url': primary.api_url,
                # 🔐 API Key NON esposta
                'model': primary.get_optimal_model(task_type, context),
                'timeout': route.timeout_override or primary.timeout_seconds,
                'max_rpm': primary.max_rpm,
            } if primary else None,
            'fallback_providers': [{
                'id': fb.id,
                'code': fb.code,
                'api_url': fb.api_url,
                'model': fb.get_optimal_model(task_type, context),
                'timeout': fb.timeout_seconds,
            } for fb in fallbacks],
            'strategy': route.routing_strategy,
            'max_retries': route.max_retries,
            'kb_modules': [{'id': kb.id, 'module_id': kb.module_id} 
                          for kb in route.kb_module_ids],
        }

    # ========================================================================
    # 🔐 PROXY DI ESECUZIONE (endpoint principale)
    # ========================================================================
    
    @http.route('/api/v6/omni/execute', type='json', auth='user', csrf=False)
    def execute_ai_task(self, task_type, payload, context=None):
        """
        🔐 ENDPOINT PRINCIPALE: Proxy di esecuzione reale.
        
        FLUSSO:
        1. Next.js invia: task_type + payload (es. messages per chat)
        2. Odoo cerca la route configurata per quel task
        3. Odoo recupera il provider primario (e fallback)
        4. Odoo decifra la API Key con erpv6_crypto
        5. Odoo chiama il provider AI esterno
        6. Se fallisce, prova il fallback
        7. Odoo registra il log (costo, durata, errore)
        8. Odoo restituisce la risposta al frontend
        
        :param task_type: Tipo di task (es. 'chat_general', 'transcription')
        :param payload: Dizionario con i dati (es. {'messages': [...], 'model': 'gpt-4'})
        :param context: Info extra per il logging (partner_id, project_id, session_id)
        :return: Risposta del provider AI
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()

        # 1. Trova la configurazione di routing per questo task
        route = request.env['erpv6.omni.route.config'].sudo().search([
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
                request.env['erpv6.omni.call.log'].sudo().create_log(
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
                    'provider_used': provider.name,
                    'cost_usd': cost,
                    'duration_ms': duration_ms
                }

            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                last_error = str(e)
                _logger.warning(f"Provider {provider.name} fallito per {task_type}: {last_error}")
                
                # ✅ Log di errore
                request.env['erpv6.omni.call.log'].sudo().create_log(
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

    # ========================================================================
    # LOGGING E STATISTICHE
    # ========================================================================
    
    @http.route('/api/v6/omni/log', type='json', auth='user', csrf=False)
    def log_call(self, task_type, provider_id, model, input_tokens, output_tokens,
                 cost_usd, status, duration_ms, error_message=None, **kwargs):
        """
        Endpoint legacy per compatibilità.
        In produzione, usa /api/v6/omni/execute che fa tutto automaticamente.
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        try:
            provider = request.env['erpv6.omni.provider'].sudo().browse(provider_id)
            if not provider.exists():
                raise UserError(f"Provider {provider_id} non trovato")
            log = request.env['erpv6.omni.call.log'].sudo().create_log(
                task_type=task_type, provider=provider, model=model,
                input_tokens=input_tokens, output_tokens=output_tokens,
                cost=cost_usd, status=status, duration=duration_ms,
                error_msg=error_message, **kwargs
            )
            return {'log_id': log.id, 'status': 'logged'}
        except Exception as e:
            _logger.error(f"Error logging AI call: {str(e)}")
            return {'log_id': None, 'status': 'error', 'message': str(e)}

    @http.route('/api/v6/omni/stats/providers', type='json', auth='user', csrf=False)
    def get_provider_stats(self, days=30):
        """Restituisce statistiche sui provider negli ultimi N giorni"""
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        stats = request.env['erpv6.omni.call.log'].sudo().get_stats_by_provider(days=days)
        return {'stats': stats}

    @http.route('/api/v6/omni/stats/costs', type='json', auth='user', csrf=False)
    def get_cost_trend(self, days=30):
        """Restituisce il trend dei costi giornalieri"""
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        trend = request.env['erpv6.omni.call.log'].sudo().get_daily_cost_trend(days=days)
        return {'trend': trend}

    @http.route('/api/v6/omni/providers', type='json', auth='user', csrf=False)
    def list_providers(self, provider_type=None, active_only=True):
        """Lista tutti i provider configurati (senza API Key)"""
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        domain = []
        if active_only:
            domain.append(('is_active', '=', True))
        if provider_type:
            domain.append(('provider_type', '=', provider_type))
        providers = request.env['erpv6.omni.provider'].sudo().search(domain)
        return {
            'providers': [{
                'id': p.id,
                'name': p.name,
                'code': p.code,
                'type': p.provider_type,
                'models': p.supported_models.split(',') if p.supported_models else [],
                # 🔐 API Key NON esposta
            } for p in providers]
        }
