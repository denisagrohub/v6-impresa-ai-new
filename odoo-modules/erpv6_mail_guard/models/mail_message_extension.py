# pylint: disable=import-error
"""13/10/2026 (C-orchestrator-1 STEP A): link esplicito email -> progetto.

x_v6_project_id: Many2one a erpv6.tracking.relation, compute store
  - mail.message con model='erpv6.tracking.relation' -> res_id
  - reply (parent_id) eredita x_v6_project_id dal parent
  - altrimenti False
x_v6_parte_id: Many2one manuale (endpoint link-project), NO compute.
x_v6_linked_by_id / x_v6_linked_at: audit trail del linking manuale.
"""
from odoo import api, fields, models


class MailMessage(models.Model):
    _inherit = 'mail.message'

    x_v6_project_id = fields.Many2one(
        'erpv6.tracking.relation',
        string='Progetto V6',
        compute='_compute_x_v6_project',
        store=True,
        index=True,
        help='Progetto V6 collegato (da routing o eredità thread)',
    )

    x_v6_parte_id = fields.Many2one(
        'erpv6.tracking.relation',
        string='Parte V6',
        index=True,
        help='Parte specifica (child con partner) — link manuale',
    )

    x_v6_linked_by_id = fields.Many2one(
        'res.users',
        string='Collegato da',
    )

    x_v6_linked_at = fields.Datetime(
        string='Collegato il',
    )

    @api.depends('model', 'res_id', 'parent_id',
                 'parent_id.x_v6_project_id')
    def _compute_x_v6_project(self):
        # Prefetch: set di relation esistenti (evita FK violation su orfane)
        existing_ids = set(
            self.env['erpv6.tracking.relation'].sudo().search([]).ids
        )
        for m in self:
            # 1. Email arrivata a un alias progetto (relation diretta)
            if m.model == 'erpv6.tracking.relation':
                if m.res_id and m.res_id in existing_ids:
                    m.x_v6_project_id = m.res_id
                else:
                    m.x_v6_project_id = False
            # 2. Email nei log custom (winwin/project) -> log.relation_id
            # 13/10/2026 (fix BUG label-progetto-diverso-dal-link):
            # la lista mostra il progetto via log.relation_id, il compute
            # deve fare lo stesso per coerenza.
            elif m.model in ('erpv6.winwin.email.log',
                             'erpv6.project.email.log'):
                log = self.env[m.model].sudo().browse(m.res_id) if m.res_id else None
                if log and log.exists() and log.relation_id \
                        and log.relation_id.id in existing_ids:
                    m.x_v6_project_id = log.relation_id.id
                elif m.parent_id and m.parent_id.x_v6_project_id:
                    m.x_v6_project_id = m.parent_id.x_v6_project_id
                else:
                    m.x_v6_project_id = False
            # 3. Reply -> eredita da parent
            elif m.parent_id and m.parent_id.x_v6_project_id:
                m.x_v6_project_id = m.parent_id.x_v6_project_id
            else:
                m.x_v6_project_id = False
