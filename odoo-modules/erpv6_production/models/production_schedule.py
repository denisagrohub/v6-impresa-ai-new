import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6ProductionSchedule(models.Model):
    _name = 'erpv6.production.schedule'
    _description = 'Assegnazione di una fase, per un ordine specifico, a una risorsa (postazione/consulente)'
    _order = 'create_date desc'

    order_id = fields.Many2one('erpv6.production.order', string='Produzione', required=True, ondelete='cascade', index=True)
    phase_id = fields.Many2one('erpv6.production.phase', string='Fase', required=True, ondelete='restrict', index=True)
    resource_id = fields.Many2one('resource.resource', string='Risorsa', index=True)
    planned_hours = fields.Float(string='Ore Pianificate')
    date_start = fields.Datetime(string='Inizio', default=fields.Datetime.now)
    date_end = fields.Datetime(string='Fine')
    state = fields.Selection([
        ('planned', 'Pianificata'),
        ('in_progress', 'In corso'),
        ('done', 'Completata'),
    ], required=True, default='planned')

    @api.model
    def create_for_phase(self, order, phase):
        """Idempotente: se esiste gia' uno schedule aperto per questo ordine
        su questa fase lo ritorna, altrimenti chiude gli schedule aperti
        precedenti dello stesso ordine (fase superata) e ne crea uno nuovo
        con risorsa auto-assegnata (bilanciamento del carico). Side-effect
        non bloccante: se il pool di risorse idonee e' vuoto, lo schedule
        resta senza resource_id e l'ordine avanza comunque."""
        order.ensure_one()
        phase.ensure_one()

        existing = self.search([
            ('order_id', '=', order.id),
            ('phase_id', '=', phase.id),
            ('state', '!=', 'done'),
        ], limit=1)
        if existing:
            return existing

        open_schedules = self.search([
            ('order_id', '=', order.id),
            ('state', '!=', 'done'),
        ])
        if open_schedules:
            open_schedules.write({'state': 'done', 'date_end': fields.Datetime.now()})

        resource = self._find_best_resource(phase)
        schedule = self.create({
            'order_id': order.id,
            'phase_id': phase.id,
            'resource_id': resource.id if resource else False,
            'planned_hours': phase.estimated_hours,
            'state': 'in_progress' if resource else 'planned',
        })

        self.env['erpv6.production.event'].create({
            'order_id': order.id,
            'event_type': 'risorsa_assegnata',
            'decision_method': 'deterministico',
            'description': (
                f"Risorsa '{resource.name}' assegnata per fase '{phase.name}'"
                if resource else
                f"Nessuna risorsa idonea disponibile per fase '{phase.name}' — schedule creato senza assegnazione"
            ),
            'phase_before_id': phase.id,
            'phase_after_id': phase.id,
        })
        return schedule

    @api.model
    def _find_best_resource(self, phase):
        """Fra le risorse idonee della fase, sceglie quella con il carico
        aperto minore (somma planned_hours degli schedule non 'done')."""
        candidates = phase.eligible_resource_ids
        if not candidates:
            return None
        return min(candidates, key=lambda r: r.get_open_workload())
