from odoo import api, fields, models
from odoo.exceptions import ValidationError


class Erpv6AcquisitionLead(models.Model):
    _name = 'erpv6.acquisition.lead'
    _description = 'Azienda nella pipeline acquisizione di un progetto'
    _order = 'write_date desc'
    _rec_name = 'partner_id'

    relation_id = fields.Many2one(
        'erpv6.tracking.relation', required=True, ondelete='cascade',
        string='Progetto')
    partner_id = fields.Many2one(
        'res.partner', required=True, ondelete='cascade', string='Azienda')
    stage_id = fields.Many2one(
        'erpv6.acquisition.stage', required=True, ondelete='restrict')
    stage_changed_at = fields.Datetime(default=fields.Datetime.now)
    notes = fields.Text()
    next_followup = fields.Date(string='Prossimo follow-up')
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ('relation_partner_uniq', 'unique(relation_id, partner_id)',
         'Azienda gia presente nella pipeline di questo progetto'),
    ]

    @api.constrains('relation_id', 'stage_id')
    def _check_stage_belongs(self):
        for lead in self:
            if lead.stage_id.relation_id != lead.relation_id:
                raise ValidationError('La fase non appartiene al progetto del lead')

    def write(self, vals):
        if 'stage_id' in vals and 'stage_changed_at' not in vals:
            vals['stage_changed_at'] = fields.Datetime.now()
        return super().write(vals)

    def action_move_to_sibling(self, child_relation_id):
        """Sposta l'azienda nella pipeline di un progetto fratello."""
        self.ensure_one()
        dest = self.env['erpv6.tracking.relation'].browse(child_relation_id)
        if dest.parent_id != self.relation_id.parent_id:
            raise ValidationError('La destinazione deve essere un progetto fratello')
        first_stage = self.env['erpv6.acquisition.stage'].search(
            [('relation_id', '=', dest.id)], order='sequence, id', limit=1)
        if not first_stage:
            raise ValidationError('Il progetto destinazione non ha fasi configurate')
        existing = self.search([
            ('relation_id', '=', dest.id),
            ('partner_id', '=', self.partner_id.id),
        ], limit=1)
        if existing:
            self.unlink()
            return existing
        self.write({
            'relation_id': dest.id,
            'stage_id': first_stage.id,
            'stage_changed_at': fields.Datetime.now(),
        })
        return self

    def action_advance(self):
        self.ensure_one()
        nxt = self.env['erpv6.acquisition.stage'].search(
            [('relation_id', '=', self.relation_id.id),
             ('sequence', '>', self.stage_id.sequence)],
            order='sequence, id', limit=1)
        if nxt:
            self.stage_id = nxt
