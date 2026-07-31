# -*- coding: utf-8 -*-
import logging
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController

_logger = logging.getLogger(__name__)


class AIAPIController(APIBaseController):
    """
    🔗 AI API Controller - Delega a erpv6_omni_bridge
    
    Questo controller espone endpoint AI tramite il gateway,
    ma tutta la logica di routing, fallback e cifratura è gestita
    dal modulo erpv6_omni_bridge.
    
    FLUSSO:
    Next.js → /api/v1/ai/chat (api_gateway)
            → erpv6_omni_bridge.execute_ai_task()
            → Provider AI esterno (OpenAI, Anthropic, Groq)
    """

    @http.route('/api/v1/ai/chat', type='json', auth='none', 
                methods=['POST'], csrf=False)
    def ai_chat(self, **kwargs):
        """
        Endpoint AI per chat/completion.
        Delega completamente a erpv6_omni_bridge.
        """
        start_time = time.time()
        
        # 1. Autenticazione (gestita da api_gateway)
        user, error = self._authenticate()
        if error:
            return error
        
        # 2. Rate limiting (gestito da api_gateway)
        rate_limit_error = self._check_rate_limit(user)
        if rate_limit_error:
            return rate_limit_error
        
        # 3. Validazione input (gestita da api_gateway)
        try:
            import json
            data = json.loads(request.httprequest.data)
            messages = data.get('messages', [])
            model = data.get('model', 'gpt-4')
            
            if not messages:
                return self._json_response({'error': 'messages richiesto'}, 400)
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)
        
        # 4. 🔗 DELEGA A OMNI_BRIDGE
        try:
            omni_result = request.env['erpv6.omni.bridge'].sudo().execute_ai_task(
                task_type='chat_general',
                payload={
                    'messages': messages,
                    'model': model,
                    'temperature': data.get('temperature', 0.7),
                },
                context={
                    'user_id': user.id,
                    'partner_id': user.partner_id.id if user.partner_id else None,
                    'session_id': data.get('session_id'),
                }
            )
            
            # 5. Logging (gestito da api_gateway)
            self._log_api_call('/api/v1/ai/chat', 'POST', user.id, 200, start_time)
            
            # 6. Ritorna risposta
            return self._json_response({
                'success': omni_result.get('success', False),
                'data': omni_result.get('data'),
                'provider_used': omni_result.get('provider_used'),
                'cost_usd': omni_result.get('cost_usd'),
                'duration_ms': omni_result.get('duration_ms'),
            })
            
        except Exception as e:
            _logger.error(f"Errore AI: {e}")
            self._log_api_call('/api/v1/ai/chat', 'POST', user.id, 500, start_time)
            return self._json_response({'error': str(e)}, 500)
    
    @http.route('/api/v1/ai/transcribe', type='json', auth='none',
                methods=['POST'], csrf=False)
    def ai_transcribe(self, **kwargs):
        """
        Endpoint AI per trascrizione audio/video.
        Delega completamente a erpv6_omni_bridge.
        """
        start_time = time.time()
        
        # Autenticazione
        user, error = self._authenticate()
        if error:
            return error
        
        try:
            import json
            data = json.loads(request.httprequest.data)
            audio_data = data.get('audio_data')
            
            if not audio_data:
                return self._json_response({'error': 'audio_data richiesto'}, 400)
            
            # 🔗 DELEGA A OMNI_BRIDGE
            omni_result = request.env['erpv6.omni.bridge'].sudo().execute_ai_task(
                task_type='transcription',
                payload={
                    'audio': audio_data,
                    'model': data.get('model', 'nova-2'),
                },
                context={
                    'user_id': user.id,
                    'partner_id': user.partner_id.id if user.partner_id else None,
                }
            )
            
            self._log_api_call('/api/v1/ai/transcribe', 'POST', user.id, 200, start_time)
            
            return self._json_response({
                'success': omni_result.get('success', False),
                'data': omni_result.get('data'),
                'provider_used': omni_result.get('provider_used'),
                'cost_usd': omni_result.get('cost_usd'),
            })
            
        except Exception as e:
            _logger.error(f"Errore trascrizione: {e}")
            self._log_api_call('/api/v1/ai/transcribe', 'POST', user.id, 500, start_time)
            return self._json_response({'error': str(e)}, 500)
