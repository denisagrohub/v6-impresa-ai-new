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
        if context is None:
            context = {}
        
        # Se viene passato solo prompt, costruisci il payload standard per chat.
        # 'model' qui (e anche quando il chiamante passa un payload esplicito,
        # es. kb_extraction_service.py) riflette SOLO il provider primario --
        # se il tentativo passa a un fallback con un catalogo modelli diverso
        # (es. Groq 'openai/gpt-oss-120b' su Cerebras, che lo chiama solo
        # 'gpt-oss-120b'), il nome sbagliato causa un 404 anche se il fallback
        # avrebbe funzionato. Risolto sotto, dentro il ciclo di tentativo,
        # sovrascrivendo 'model' col catalogo del provider CHE SI STA
        # provando in quel momento (stessa provider.get_optimal_model()
        # che il chiamante ha gia' usato per il solo provider primario).
        if payload is None and prompt:
            payload = {
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                'model': 'gpt-4-turbo',
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
        
        # 2-3. Selezione dinamica del provider via route.get_next_provider()
        # -- prima la lista era statica [primary]+fallback indipendentemente
        # da routing_strategy (cost/priority/speed mai applicata, dead code:
        # get_next_provider esisteva ma non veniva mai chiamato). Trovato da
        # un agente di verifica dedicato il 21/08/2026. excluded_provider_ids
        # accumula sia i provider davvero tentati (rete) sia quelli scartati
        # dal circuit breaker, altrimenti get_next_provider riproporrebbe
        # all'infinito un provider gia' escluso per quel motivo.
        attempted_providers = []  # id con una VERA chiamata di rete (per max_retries)
        excluded_provider_ids = []
        last_error = None

        while True:
            try:
                provider = route.get_next_provider(attempted_providers=excluded_provider_ids)
            except UserError:
                # Nessun candidato rimasto -- stesso esito di "lista esaurita".
                break

            # Verifica circuit breaker
            if not provider.is_available():
                _logger.info(f"Provider {provider.name} non disponibile (circuit breaker)")
                excluded_provider_ids.append(provider.id)
                continue

            attempted_providers.append(provider.id)
            excluded_provider_ids.append(provider.id)
            start_time = time.time()
            
            try:
                # Definito subito: deve esistere anche se l'eccezione arriva
                # prima della risoluzione del modello sotto (es. API Key
                # mancante), altrimenti il logging nel blocco except fallisce.
                call_payload = payload

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

                # Risolvi il modello per QUESTO provider (vedi commento sopra)
                # -- se non ha un modello configurato per il task, tenta
                # comunque col 'model' originale del payload piuttosto che
                # abortire subito: potrebbe funzionare (stesso nome modello
                # tra provider compatibili) o fallire in modo esplicito,
                # comunque gestito dal blocco except sotto.
                optimal_model = provider.get_optimal_model(task_type)
                if optimal_model:
                    call_payload = dict(payload, model=optimal_model)

                # Esegui la chiamata HTTP reale
                response = requests.post(
                    url,
                    json=call_payload,
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
                    model=call_payload.get('model', 'unknown'),
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
                    model=call_payload.get('model', 'unknown'),
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
        attempted_provider_records = self.env['erpv6.omni.provider'].sudo().browse(attempted_providers)
        return {
            'success': False,
            'error': f'Tutti i provider hanno fallito. Ultimo errore: {last_error}',
            'attempted_providers': attempted_provider_records.mapped('name')
        }
