import logging

from odoo import models

_logger = logging.getLogger(__name__)


class CrmLead(models.Model):
    _inherit = 'crm.lead'

    def _start_production(self, score=None, package_hint=None, verticale=None, **kwargs):
        """Crea la prima erpv6.production.order per questo lead, in fase
        iniziale 'diagnostica'. Chiamato da lead_api.py (stesso pattern
        hasattr/duck-typing gia' usato per _start_funnel), mai chiamato
        direttamente da erpv6_api_gateway come dipendenza dichiarata.

        Fase 1: crea solo il record e il primo evento. Nessuna logica di
        avanzamento automatico (arriva in Fase 2).
        """
        self.ensure_one()
        initial_phase = self.env.ref('erpv6_production.phase_diagnostica', raise_if_not_found=False)

        project = self.env['project.project'].sudo().create({
            'name': self.name or self.partner_name or self.contact_name or 'Nuovo progetto',
            'user_id': self.user_id.id if self.user_id else self.env.user.id,
        })

        order = self.env['erpv6.production.order'].sudo().create({
            'lead_id': self.id,
            'phase_id': initial_phase.id if initial_phase else False,
            'interview_score': score or 0,
            'interview_package_hint': package_hint or '',
            'verticale': verticale or '',
            'project_id': project.id,
        })
        self.env['erpv6.production.event'].sudo().create({
            'order_id': order.id,
            'event_type': 'cron_automatico',
            'description': 'Produzione creata automaticamente alla ricezione del lead.',
            'phase_after_id': initial_phase.id if initial_phase else False,
            'decision_method': 'deterministico',
        })
        return order
