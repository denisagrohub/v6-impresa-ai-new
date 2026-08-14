# -*- coding: utf-8 -*-
import logging
from odoo import models, fields, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

class OmniRouteConfig(models.Model):
    _name = 'erpv6.omni.route.config'
    _description = 'Configurazione Routing OmniRoute per Task AI'
    _order = 'task_type, priority'

    task_type = fields.Char(string='Tipo Task', required=True,
                            help="Es: chat_general, transcription, rag_query, summarization")
    name = fields.Char(string='Nome Regola', required=True)
    description = fields.Text(string='Descrizione')

    # Provider configurati per questo task
    primary_provider_id = fields.Many2one('erpv6.omni.provider', 
                                          string='Provider Primario', 
                                          domain=[('is_active', '=', True)])
    fallback_provider_ids = fields.Many2many('erpv6.omni.provider', 
                                             'omni_route_fallback_rel',
                                             'route_id', 'provider_id',
                                             string='Provider Fallback',
                                             domain=[('is_active', '=', True)])
    
    # Logica routing
    priority = fields.Integer(string='Priorità', default=10)
    routing_strategy = fields.Selection([
        ('priority', 'Priorità Fissa'),
        ('cost', 'Minimo Costo'),
        ('speed', 'Massima Velocità'),
        ('balanced', 'Bilanciato'),
        ('round_robin', 'Round Robin'),
    ], string='Strategia Routing', default='priority')
    
    # Soglie e limiti
    max_retries = fields.Integer(string='Max Tentativi', default=3)
    timeout_override = fields.Integer(string='Timeout Override (s)')
    max_cost_per_call = fields.Float(string='Costo Max per Chiamata ($)')
    
    # Contesto KB opzionale
    kb_module_ids = fields.Many2many('erpv6.kb',
                                     'omni_route_kb_rel',
                                     'route_id', 'kb_id',
                                     string='Moduli KB di Riferimento',
                                     help='Knowledge Base di riferimento per il contesto del task')
    
    is_active = fields.Boolean(string='Attiva', default=True)

    def get_next_provider(self, attempted_providers=None):
        """
        Restituisce il prossimo provider da usare in base alla strategia.
        attempted_providers: lista di ID provider già tentati (per fallback)
        """
        self.ensure_one()
        
        if attempted_providers is None:
            attempted_providers = []
        
        candidates = []
        
        # Aggiungi primario se non tentato
        if self.primary_provider_id and self.primary_provider_id.id not in attempted_providers:
            candidates.append(self.primary_provider_id)
        
        # Aggiungi fallback non tentati
        for fb in self.fallback_provider_ids:
            if fb.id not in attempted_providers:
                candidates.append(fb)
        
        if not candidates:
            raise UserError(_("Nessun provider disponibile dopo {} tentativi.").format(
                len(attempted_providers)))
        
        # Applica strategia
        if self.routing_strategy == 'priority':
            candidates.sort(key=lambda p: p.priority)
        elif self.routing_strategy == 'cost':
            candidates.sort(key=lambda p: p.cost_per_1k_input + p.cost_per_1k_output)
        elif self.routing_strategy == 'speed':
            # Priorità più alta = generalmente più veloce
            candidates.sort(key=lambda p: p.priority)
        
        return candidates[0]

    def action_test_routing(self):
        """Testa la catena di routing"""
        self.ensure_one()
        message = f"Testing routing for '{self.task_type}'...\n"
        message += f"Primary: {self.primary_provider_id.name}\n"
        message += f"Fallbacks: {', '.join(self.fallback_provider_ids.mapped('name'))}\n"
        message += f"Strategy: {self.routing_strategy}"
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Test Routing'),
                'message': message,
                'type': 'info',
                'sticky': False,
            }
        }
