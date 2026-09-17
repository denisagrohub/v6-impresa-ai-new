from odoo import fields, models


class Erpv6ProspectionActivity(models.Model):
    _name = 'erpv6.prospection.activity'
    _description = 'Attivita di prospezione (telefonate, email, messaggi)'
    _order = 'planned_date, id'

    relation_id = fields.Many2one(
        'erpv6.tracking.relation', required=True, ondelete='cascade',
        string='Progetto')
    partner_id = fields.Many2one(
        'res.partner', required=True, ondelete='cascade', string='Azienda')
    lead_id = fields.Many2one(
        'erpv6.acquisition.lead', ondelete='set null', string='Lead pipeline')
    activity_type = fields.Selection([
        ('call', 'Telefonata'),
        ('email', 'Email'),
        ('message', 'Messaggio'),
    ], required=True, default='call')
    planned_date = fields.Date(required=True, default=fields.Date.context_today)
    state = fields.Selection([
        ('todo', 'Da fare'),
        ('done', 'Fatta'),
        ('deferred', 'Rimandata'),
        ('cancelled', 'Annullata'),
    ], required=True, default='todo', index=True)
    outcome = fields.Selection([
        ('interested', 'Interessata'),
        ('not_interested', 'Non interessata'),
        ('callback', 'Da richiamare'),
        ('no_answer', 'Non risponde'),
        ('waiting', 'In attesa risposta'),
        ('other', 'Altro'),
    ])
    notes = fields.Text()
    deferred_to = fields.Date(string='Rimandata al')

    def action_done(self):
        """Segna fatta e crea il lead in pipeline se assente (Denis, 14/09/2026)."""
        for act in self.filtered(lambda a: a.state == 'todo'):
            act.state = 'done'
            lead = self.env['erpv6.acquisition.lead'].search([
                ('relation_id', '=', act.relation_id.id),
                ('partner_id', '=', act.partner_id.id),
            ], limit=1)
            if not lead:
                first_stage = self.env['erpv6.acquisition.stage'].search(
                    [('relation_id', '=', act.relation_id.id)],
                    order='sequence, id', limit=1)
                if first_stage:
                    lead = self.env['erpv6.acquisition.lead'].create({
                        'relation_id': act.relation_id.id,
                        'partner_id': act.partner_id.id,
                        'stage_id': first_stage.id,
                    })
            if lead:
                act.lead_id = lead
