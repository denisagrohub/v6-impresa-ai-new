from odoo import fields, models


class ResourceResource(models.Model):
    _inherit = 'resource.resource'

    schedule_ids = fields.One2many('erpv6.production.schedule', 'resource_id', string='Pianificazioni Produzione')

    def get_open_workload(self):
        """Somma delle planned_hours degli schedule non ancora 'done' su
        questa risorsa - usato da erpv6.production.schedule per scegliere
        automaticamente la risorsa meno carica."""
        self.ensure_one()
        open_schedules = self.env['erpv6.production.schedule'].search([
            ('resource_id', '=', self.id),
            ('state', '!=', 'done'),
        ])
        return sum(open_schedules.mapped('planned_hours'))

    def get_workload(self, date_from, date_to):
        """Aggregazione multi-progetto: somma planned_hours degli schedule
        di questa risorsa con date_start nell'intervallo [date_from, date_to]."""
        self.ensure_one()
        schedules = self.env['erpv6.production.schedule'].search([
            ('resource_id', '=', self.id),
            ('date_start', '>=', date_from),
            ('date_start', '<=', date_to),
        ])
        return sum(schedules.mapped('planned_hours'))
