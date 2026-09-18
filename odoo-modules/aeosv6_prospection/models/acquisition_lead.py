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

    @api.model
    def action_move_to_stage(self, lead_id, stage_id):
        """Drag&drop kanban: sposta un lead a una fase specifica.
        Valida che la fase appartenga alla stessa relazione del lead."""
        lead = self.browse(lead_id)
        if not lead.exists():
            raise ValueError('Lead non trovato')
        stage = self.env['erpv6.acquisition.stage'].browse(stage_id)
        if not stage.exists():
            raise ValueError('Fase non trovata')
        if stage.relation_id != lead.relation_id:
            raise ValueError('La fase non appartiene al progetto del lead')
        lead.write({'stage_id': stage.id})
        return {'ok': True, 'lead_id': lead.id, 'stage_id': stage.id,
                'stage_name': stage.name, 'is_won': stage.is_won, 'is_lost': stage.is_lost}

    @api.model
    def api_move_to_sibling(self, lead_id, dest_relation_id):
        """API wrapper per frontend: sposta il lead nella pipeline di un progetto
        fratello (stesso padre). Riusa la logica di action_move_to_sibling(self)
        già esistente sulla classe (Denis, 18/09/2026: 'quella azienda non può
        andare bene per quel progetto, ma può essere eleggibile per altri')."""
        lead = self.browse(lead_id)
        if not lead.exists():
            raise ValueError('Lead non trovato')
        # il metodo originale opera su self (singolo record) e ritorna il record
        result = lead.action_move_to_sibling(dest_relation_id)
        return {'ok': True, 'lead_id': result.id if result else lead.id,
                'dest_relation_id': dest_relation_id}

    @api.model
    def action_suggest_siblings(self, lead_id):
        """Ritorna i progetti fratelli in cui il lead potrebbe essere eleggibile
        (stesso padre, stessa azienda non presente)."""
        lead = self.browse(lead_id)
        if not lead.exists():
            raise ValueError('Lead non trovato')
        parent = lead.relation_id.parent_id
        if not parent:
            return []
        siblings = self.env['erpv6.tracking.relation'].search([
            ('parent_id', '=', parent.id),
            ('id', '!=', lead.relation_id.id),
            ('child_kind', 'in', ['sotto_progetto', 'pipeline']),
        ])
        result = []
        for sib in siblings:
            # escludi se la stessa azienda è già presente
            exists = self.search_count([
                ('relation_id', '=', sib.id),
                ('partner_id', '=', lead.partner_id.id),
            ])
            result.append({
                'relation_id': sib.id,
                'name': sib.name,
                'already_present': bool(exists),
            })
        return result
