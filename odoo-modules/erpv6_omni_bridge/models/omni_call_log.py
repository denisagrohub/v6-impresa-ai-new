# -*- coding: utf-8 -*-
import logging
from datetime import timedelta
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
    
    res_model = fields.Char(string='Modello Odoo Collegato', index=True)
    res_id = fields.Integer(string='ID Record', index=True)
    session_id = fields.Char(string='Sessione ID', index=True)
    
    created_at = fields.Datetime(string='Data/Ora', default=fields.Datetime.now, required=True, index=True)
    
    partner_id = fields.Many2one('res.partner', string='Cliente')
    consultant_id = fields.Many2one('res.partner', string='Consulente', domain=[('is_consultant', '=', True)])

    @api.model
    def create_log(self, task_type, provider, model, input_tokens, output_tokens,
                   cost, status, duration, error_msg=None, **kwargs):
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
        """Ottimizzato con read_group per evitare loop N+1 in Python"""
        cutoff = fields.Datetime.now() - timedelta(days=days)
        domain = [('created_at', '>=', cutoff)]
        
        stats_raw = self.read_group(
            domain=domain,
            fields=['provider_id', 'cost_usd', 'duration_ms', 'status'],
            groupby=['provider_id', 'status'],
            lazy=False
        )
        
        stats = {}
        for s in stats_raw:
            pid = s['provider_id'][0] if s['provider_id'] else 0
            pname = s['provider_id'][1] if s['provider_id'] else 'Unknown'
            
            if pid not in stats:
                stats[pid] = {
                    'name': pname, 'calls': 0, 'success': 0, 'error': 0, 
                    'cost': 0.0, 'total_duration': 0
                }
            
            stats[pid]['calls'] += s['__count']
            stats[pid]['cost'] += s['cost_usd'] or 0.0
            stats[pid]['total_duration'] += s['duration_ms'] or 0
            
            if s['status'] == 'success':
                stats[pid]['success'] += s['__count']
            else:
                stats[pid]['error'] += s['__count']
                
        result = []
        for pid, s in stats.items():
            s['avg_duration'] = s['total_duration'] / s['calls'] if s['calls'] > 0 else 0
            del s['total_duration']
            result.append(s)
            
        return result

    @api.model
    def get_daily_cost_trend(self, days=30):
        """Ottimizzato con read_group per aggregazione giornaliera"""
        cutoff = fields.Datetime.now() - timedelta(days=days)
        domain = [('created_at', '>=', cutoff), ('status', '=', 'success')]
        
        trend_raw = self.read_group(
            domain=domain,
            fields=['cost_usd', 'created_at'],
            groupby=['created_at:day'],
            lazy=False
        )
        
        return [{'date': t['created_at'], 'cost': t['cost_usd'] or 0.0} for t in trend_raw]
