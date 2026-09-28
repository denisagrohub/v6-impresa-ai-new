# -*- coding: utf-8 -*-
"""28/09/2026: Checklist deal V6 — wizard per fase."""
import logging

from odoo import api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

COMPLETION_TYPES = [
    ('sign', 'Firma elettronica (Documenso)'),
    ('upload', 'Carica documento firmato'),
    ('check', 'Conferma manuale'),
    ('system', 'Evento di sistema'),
    ('external', 'Attesa esterna'),
]

STEP_STATUS = [
    ('pending', 'Da fare'),
    ('in_progress', 'In corso'),
    ('done', 'Completato'),
    ('skipped', 'Saltato'),
    ('na', 'Non applicabile'),
]


class Erpv6DealSchemaStep(models.Model):
    _name = 'erpv6.deal.schema.step'
    _description = 'Template step checklist deal'
    _order = 'schema_id, sequence, id'

    schema_id = fields.Many2one('erpv6.deal.schema', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    code = fields.Char(required=True, index=True)
    label = fields.Char(required=True)
    description = fields.Text()
    completion_type = fields.Selection(COMPLETION_TYPES, default='check', required=True)
    blocks_deal_state = fields.Boolean(default=False)
    requires_codes = fields.Char()
    template_document_code = fields.Char()
    auto_generate = fields.Boolean(default=True)

    _sql_constraints = [
        ('unique_code_per_schema', 'UNIQUE(schema_id, code)',
         'Esiste già uno step con questo codice nello schema.'),
    ]


class Erpv6DealChecklist(models.Model):
    _name = 'erpv6.deal.checklist'
    _description = 'Step checklist deal (istanza)'
    _order = 'deal_id, sequence, id'
    _inherit = ['mail.thread']

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    code = fields.Char(required=True, index=True)
    label = fields.Char(required=True)
    description = fields.Text()
    completion_type = fields.Selection(COMPLETION_TYPES, default='check', required=True)
    blocks_deal_state = fields.Boolean(default=False)
    requires_codes = fields.Char()
    template_document_code = fields.Char()
    status = fields.Selection(STEP_STATUS, default='pending', required=True, tracking=True, index=True)

    sign_request_id = fields.Many2one('erpv6.sign.request', string='Richiesta firma', ondelete='set null')
    attachment_id = fields.Many2one('ir.attachment', string='Documento firmato', ondelete='set null')
    external_reference = fields.Char(string='Rif. esterno')

    started_at = fields.Datetime(readonly=True)
    completed_at = fields.Datetime(readonly=True, tracking=True)
    completed_by = fields.Many2one('res.users', readonly=True, tracking=True)
    evidence_note = fields.Text()

    is_ready = fields.Boolean(compute='_compute_is_ready')
    is_blocking = fields.Boolean(compute='_compute_is_ready')

    @api.depends('requires_codes', 'deal_id.checklist_ids.code',
                 'deal_id.checklist_ids.status', 'blocks_deal_state', 'status')
    def _compute_is_ready(self):
        for rec in self:
            if rec.requires_codes:
                required = [c.strip() for c in rec.requires_codes.split(',') if c.strip()]
                done_codes = set(rec.deal_id.checklist_ids.filtered(lambda c: c.status == 'done').mapped('code'))
                rec.is_ready = all(c in done_codes for c in required)
            else:
                rec.is_ready = True
            rec.is_blocking = rec.blocks_deal_state and rec.status != 'done'

    def action_start(self):
        for rec in self:
            if rec.status == 'pending':
                rec.write({'status': 'in_progress', 'started_at': fields.Datetime.now()})
        return True

    def action_complete(self, note=None, attachment=None):
        for rec in self:
            if rec.status == 'done':
                continue
            vals = {'status': 'done', 'completed_at': fields.Datetime.now(), 'completed_by': self.env.user.id}
            if note:
                vals['evidence_note'] = note
            if attachment:
                vals['attachment_id'] = attachment
            rec.write(vals)
            rec.deal_id.message_post(body=f"✓ Step: {rec.label}" + (f" — {note}" if note else ""))
        return True

    def action_skip(self, reason=None):
        for rec in self:
            if rec.blocks_deal_state:
                raise UserError(f"Impossibile saltare '{rec.label}': step bloccante.")
            rec.write({
                'status': 'skipped',
                'evidence_note': (reason or '') + ' [SALTATO]',
                'completed_at': fields.Datetime.now(),
                'completed_by': self.env.user.id,
            })
            rec.deal_message_post = rec.deal_id.message_post
            rec.deal_id.message_post(body=f"⏭ Step saltato: {rec.label}")
        return True
