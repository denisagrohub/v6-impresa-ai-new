# -*- coding: utf-8 -*-
import logging
import json
import time
from odoo import http
from odoo.http import request, Response
from odoo.exceptions import AccessDenied, UserError

_logger = logging.getLogger(__name__)

class OmniRouteAPI(http.Controller):
    """
    API JSON-RPC per il routing delle chiamate AI.
    Queste API sono chiamate dal frontend Next.js per:
    1. Ottenere la configurazione di routing per un task
    2. Registrare il risultato di una chiamata (log)
    3. Ottenere statistiche e costi
    """

    @http.route('/api/v6/omni/route', type='json', auth='user', csrf=False)
    def get_route_config(self, task_type, context=None):
        """
        Restituisce la configurazione di routing per un task specifico.
        
        :param task_type: Tipo di task (es: 'chat_general', 'transcription')
        :param context: Contesto opzionale (partner_id, session_id, ecc.)
        :return: Configurazione con provider primario, fallback e strategia
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        
        route = request.env['erpv6.omni.route.config'].sudo().search([
            ('task_type', '=', task_type),
            ('is_active', '=', True)
        ], limit=1, order='priority asc')
        
        if not route:
            # Ritorna configurazione default se nessuna regola specifica
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
                'api_key': primary.api_key,  # Attenzione: solo se chiamato in modo sicuro
                'model': primary.get_optimal_model(task_type, context),
                'timeout': route.timeout_override or primary.timeout_seconds,
                'max_rpm': primary.max_rpm,
            } if primary else None,
            'fallback_providers': [{
                'id': fb.id,
                'code': fb.code,
                'api_url': fb.api_url,
                'api_key': fb.api_key,
                'model': fb.get_optimal_model(task_type, context),
                'timeout': fb.timeout_seconds,
            } for fb in fallbacks],
            'strategy': route.routing_strategy,
            'max_retries': route.max_retries,
            'kb_modules': [{
                'id': kb.id,
                'module_id': kb.module_id,
            } for kb in route.kb_module_ids],
        }

    @http.route('/api/v6/omni/log', type='json', auth='user', csrf=False)
    def log_call(self, task_type, provider_id, model, input_tokens, output_tokens,
                 cost_usd, status, duration_ms, error_message=None, **kwargs):
        """
        Registra una chiamata AI nel log.
        
        :param task_type: Tipo di task
        :param provider_id: ID del provider usato
        :param model: Modello utilizzato
        :param input_tokens: Token in input
        :param output_tokens: Token in output
        :param cost_usd: Costo della chiamata in USD
        :param status: 'success' o 'error'
        :param duration_ms: Durata in millisecondi
        :param error_message: Messaggio di errore se status='error'
        :param kwargs: Campi extra (partner_id, session_id, res_model, res_id)
        :return: ID del log creato
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        
        try:
            provider = request.env['erpv6.omni.provider'].browse(provider_id)
            if not provider.exists():
                raise UserError(f"Provider {provider_id} non trovato")
            
            log = request.env['erpv6.omni.call.log'].sudo().create_log(
                task_type=task_type,
                provider=provider,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost_usd,
                status=status,
                duration=duration_ms,
                error_msg=error_message,
                **kwargs
            )
            
            return {'log_id': log.id, 'status': 'logged'}
        
        except Exception as e:
            _logger.error(f"Error logging AI call: {str(e)}")
            return {'log_id': None, 'status': 'error', 'message': str(e)}

    @http.route('/api/v6/omni/stats/providers', type='json', auth='user', csrf=False)
    def get_provider_stats(self, days=30):
        """
        Restituisce statistiche sui provider negli ultimi N giorni.
        
        :param days: Numero di giorni da considerare (default 30)
        :return: Lista di statistiche per provider
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        
        stats = request.env['erpv6.omni.call.log'].sudo().get_stats_by_provider(days=days)
        return {'stats': stats}

    @http.route('/api/v6/omni/stats/costs', type='json', auth='user', csrf=False)
    def get_cost_trend(self, days=30):
        """
        Restituisce il trend dei costi giornalieri.
        
        :param days: Numero di giorni (default 30)
        :return: Lista di {date, cost}
        """
        if not request.env.user.has_group('base.group_user'):
            raise AccessDenied()
        
        trend = request.env['erpv6.omni.call.log'].sudo().get_daily_cost_trend(days=days)
        return {'trend': trend}

    @http.route('/api/v6/omni/providers', type='json', auth='user', csrf=False)
    def list_providers(self, provider_type=None, active_only=True):
        """
        Lista tutti i provider configurati.
        
        :param provider_type: Filtra per tipo (llm, transcription, ecc.)
        :param active_only: Se True, ritorna solo provider attivi
        :return: Lista di provider
        """
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
            } for p in providers]
        }
