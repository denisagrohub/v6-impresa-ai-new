# -*- coding: utf-8 -*-
"""Modello: richiesta di accesso al playbook di un progetto.

30/09/2026 — Flusso opt-in consultant:
- Un progetto (tracking_relation) può essere pubblicato nel catalogo
  consultant con `x_v6_catalog_visible=True`.
- Un consultant sfoglia il catalogo (endpoint /consultant/projects/catalog)
  e invia una richiesta di accesso (POST /request-access).
- Admin o chief_projects approva/rifiuta.
- Su approvazione: il consultant entra in `access_user_ids` del progetto,
  e (opzionale, default) diventa un nodo figlio `parte`.
"""

from odoo import api, fields, models
from odoo.exceptions import UserError


class ProjectAccessRequest(models.Model):
    _name = 'erpv6.project.access.request'
    _description = 'Richiesta accesso al playbook di un progetto'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    name = fields.Char(
        string='Riferimento', compute='_compute_name', store=True,
        help='Sintesi leggibile: <progetto> — <utente>')
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        required=True, ondelete='cascade', index=True)
    user_id = fields.Many2one(
        'res.users', string='Richiedente',
        required=True, ondelete='cascade', index=True)
    partner_id = fields.Many2one(
        'res.partner', string='Partner collegato',
        help='Partner da agganciare come nodo parte su approvazione. '
             'Se vuoto, usa user_id.partner_id.')
    message = fields.Text(
        string='Motivazione',
        help='Perché il consultant chiede di accedere a questo progetto.')

    state = fields.Selection([
        ('pending', 'In attesa'),
        ('approved', 'Approvata'),
        ('rejected', 'Rifiutata'),
        ('cancelled', 'Annullata'),
    ], string='Stato', default='pending', required=True, tracking=True, index=True)

    approved_by = fields.Many2one(
        'res.users', string='Approvata da', readonly=True)
    approved_at = fields.Datetime(string='Approvata il', readonly=True)
    rejected_reason = fields.Text(string='Motivo rifiuto', readonly=True)
    creates_part_node = fields.Boolean(
        string='Crea nodo parte',
        default=True,
        help='Se True, su approvazione crea anche un nodo figlio '
             '"parte" collegato al partner del richiedente.')

    @api.depends('relation_id.name', 'user_id.name')
    def _compute_name(self):
        for rec in self:
            proj = rec.relation_id.name or '—'
            user = rec.user_id.name or '—'
            rec.name = f'{proj} — {user}'

    @api.model_create_multi
    def create(self, vals_list):
        """Imposta partner_id default = user.partner_id se mancante."""
        for vals in vals_list:
            if not vals.get('partner_id') and vals.get('user_id'):
                u = self.env['res.users'].sudo().browse(vals['user_id'])
                if u.partner_id:
                    vals['partner_id'] = u.partner_id.id
        return super().create(vals_list)

    def action_approve(self, creates_part_node=None):
        """Approva la richiesta.

        - Aggiunge user_id a relation.access_user_ids
        - (opzionale) crea nodo parte figlio
        - Scrive state, approved_by, approved_at
        - message_post sul progetto
        """
        for rec in self:
            if rec.state != 'pending':
                raise UserError("Solo le richieste in attesa possono essere approvate.")
            if creates_part_node is not None:
                rec.creates_part_node = bool(creates_part_node)

            rel = rec.relation_id
            user = rec.user_id

            # 1. Accesso
            if user not in rel.access_user_ids:
                rel.sudo().write({'access_user_ids': [(4, user.id)]})

            # 2. Nodo parte (opzionale)
            if rec.creates_part_node and rec.partner_id:
                already = rel.child_ids.filtered(
                    lambda c: c.partner_id == rec.partner_id and c.child_kind == 'parte')
                if not already:
                    self.env['erpv6.tracking.relation'].sudo().create({
                        'name': rec.partner_id.name or user.name,
                        'parent_id': rel.id,
                        'child_kind': 'parte',
                        'funzione_progetto': 'consulente_operativo',
                        'partner_id': rec.partner_id.id,
                    })

            # 3. Stato
            rec.write({
                'state': 'approved',
                'approved_by': self.env.user.id,
                'approved_at': fields.Datetime.now(),
            })

            rel.message_post(body=(
                f"✅ Accesso approvato per <b>{user.name}</b> "
                f"({'con' if rec.creates_part_node else 'senza'} nodo parte). "
                f"Approvato da {self.env.user.name}."
            ))

    def action_reject(self, reason=None):
        """Rifiuta la richiesta con motivazione opzionale."""
        for rec in self:
            if rec.state != 'pending':
                raise UserError("Solo le richieste in attesa possono essere rifiutate.")
            rec.write({
                'state': 'rejected',
                'rejected_reason': reason or '',
                'approved_by': self.env.user.id,
                'approved_at': fields.Datetime.now(),
            })
            rec.relation_id.message_post(body=(
                f"❌ Richiesta accesso rifiutata per <b>{rec.user_id.name}</b>. "
                f"Motivo: {reason or '—'}"
            ))

    def action_cancel(self):
        """Annulla (solo dal richiedente, prima della decisione)."""
        for rec in self:
            if rec.state != 'pending':
                raise UserError("Solo le richieste in attesa possono essere annullate.")
            if rec.user_id.id != self.env.user.id and not self.env.user.has_group('base.group_system'):
                raise UserError("Solo il richiedente o un admin possono annullare.")
            rec.write({'state': 'cancelled'})

    _sql_constraints = [
        ('unique_pending_per_user_project',
         'UNIQUE (relation_id, user_id, state)',
         'Esiste già una richiesta per questo progetto da parte di questo utente.'),
    ]
