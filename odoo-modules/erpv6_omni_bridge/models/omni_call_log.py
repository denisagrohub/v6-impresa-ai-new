# -*- coding: utf-8 -*-
import logging
from odoo import models, fields, api

_logger = logging.getLogger(__name__)

class OmniCallLog(models.Model):
    _name = 'erpv6.omni.call.log'
    _description = 'Log Chiamate AI con Provider Esterni'
    _order = 'created_at desc'
    _rec_name = 'task_type'

    task_type = fields.Char(string='Tipo Task', required=True, index=True)
    provider_id = fields.Many2one('erpv6.omni.provider', string='Provider Usato', required=True, index=True)
    model_used = fields.Char(string='Modello Usato')
    
    # Request/Response (solo metadati, non il contenuto completo per privacy/performance)
    input_tokens = fields.Integer(string='Token Input')
    output_tokens = fields.Integer(string='Token Output')
    cost_usd = fields.Float(string='Costo ($)', digits=(10, 6))
    
    status = fields.Selection([
        ('success', 'Successo'),
        ('error', 'Errore'),
        ('timeout', 'Timeout'),
        ('rate_limited', 'Rate Limited'),
    ], string='Stato', default='success', index=True)
    
    error_message = fields.Text(string='Messaggio Errore')
    retry_count = fields.Integer(string='Tentativi', default=0)
    duration_ms = fields.Integer(string='Durata (ms)')
    
    # Contesto opzionale
    res_model = fields.Char(string='Modello Odoo Collegato', index=True)
    res_id = fields.Integer(string='ID Record', index=True)
    session_id = fields.Char(string='Sessione ID', index=True)
    
    created_at = fields.Datetime(string='Data/Ora', default=fields.Datetime.now, required=True, index=True)
    
    # Riferimenti business
    partner_id = fields.Many2one('res.partner', string='Cliente')
    consultant_id = fields.Many2one('res.partner', string='Consulente', 
                                    domain=[('is_consultant', '=', True)])

    @api.model
    def create_log(self, task_type, provider, model, input_tokens, output_tokens, 
                   cost, status, duration, error_msg=None, **kwargs):
        """Crea un log di chiamata in modo efficiente"""
        return self.create({
            'task_type': task_type,
            'provider_id': provider.id if hasattr(provider, 'id') else provider,
            'model_used': model,
            'input_tokens': input_tokens or 0,
            'output_tokens': output_tokens or 0,
            'cost_usd': cost or 0.0,
            'status': status,
            'error_message': error_msg,
            'duration_ms': duration or 0,
            'res_model': kwargs.get('res_model'),
            'res_id': kwargs.get('res_id'),
            'session_id': kwargs.get('session_id'),
            'partner_id': kwargs.get('partner_id'),
            'consultant_id': kwargs.get('consultant_id'),
        })

    @api.model
    def get_stats_by_provider(self, days=30):
        """Restituisce statistiche per provider negli ultimi N giorni"""
        from datetime import timedelta
        cutoff = fields.Datetime.now() - timedelta(days=days)
        
        domain = [('created_at', '>=', cutoff)]
        logs = self.search(domain)
        
        stats = {}
        for log in logs:
            pid = log.provider_id.id
            if pid not in stats:
                stats[pid] = {
                    'name': log.provider_id.name,
                    'calls': 0,
                    'success': 0,
                    'error': 0,
                    'cost': 0.0,
                    'avg_duration': 0,
                }
            stats[pid]['calls'] += 1
            if log.status == 'success':
                stats[pid]['success'] += 1
            else:
                stats[pid]['error'] += 1
            stats[pid]['cost'] += log.cost_usd
        
        # Calcola medie
        for pid, s in stats.items():
            if s['calls'] > 0:
                total_duration = sum(l.duration_ms for l in logs if l.provider_id.id == pid)
                s['avg_duration'] = total_duration / s['calls']
        
        return list(stats.values())

    @api.model
    def get_daily_cost_trend(self, days=30):
        """Restituisce trend costi giornalieri"""
        from datetime import timedelta
        from collections import defaultdict
        
        cutoff = fields.Datetime.now() - timedelta(days=days)
        domain = [('created_at', '>=', cutoff), ('status', '=', 'success')]
        logs = self.search(domain)
        
        daily_costs = defaultdict(float)
        for log in logs:
            date_str = log.created_at.date().isoformat()
            daily_costs[date_str] += log.cost_usd
        
        return [{'date': k, 'cost': v} for k, v in sorted(daily_costs.items())]
