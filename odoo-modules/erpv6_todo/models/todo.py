# pylint: disable=import-error
"""TODO operativi V6 Impresa.

01/10/2026 (Fase C - C1a-1): ogni utente ha la sua lista TODO.
Record rule: vede solo i propri. Admin bypassa la rule (group_system).
Placeholder is_auto/source per C1b (TODO generati automaticamente da
motori/KB).
"""
from odoo import api, fields, models


class Erpv6Todo(models.Model):
    _name = 'erpv6.todo'
    _description = 'TODO V6 Impresa'
    _order = 'state, due_date asc, create_date desc'

    name = fields.Char(string='Descrizione', required=True)
    description = fields.Text(string='Note')

    user_id = fields.Many2one(
        'res.users', string='Assegnato a',
        required=True,
        default=lambda self: self.env.user,
        index=True,
    )

    project_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto Partner',
        ondelete='set null', index=True,
    )
    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal',
        ondelete='set null', index=True,
    )

    due_date = fields.Date(string='Scadenza', index=True)

    state = fields.Selection(
        selection=[
            ('open', 'Aperto'),
            ('done', 'Fatto'),
            ('cancelled', 'Annullato'),
        ],
        string='Stato', default='open', required=True, index=True,
    )

    done_at = fields.Datetime(string='Completato il', readonly=True)

    # Prep per C1b (TODO automatici)
    is_auto = fields.Boolean(
        string='Generato automaticamente', default=False, readonly=True,
    )
    source = fields.Char(
        string='Origine', readonly=True,
        help='Vuoto per TODO manuali. In C1b: nome del motore/KB.',
    )

    active = fields.Boolean(default=True)

    def write(self, vals):
        if vals.get('state') == 'done':
            vals['done_at'] = fields.Datetime.now()
        elif vals.get('state') in ('open', 'cancelled'):
            vals['done_at'] = False
        return super().write(vals)

    def action_done(self):
        self.write({'state': 'done'})

    def action_reopen(self):
        self.write({'state': 'open'})
