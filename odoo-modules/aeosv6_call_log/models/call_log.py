from odoo import api, fields, models


class Erpv6CallLog(models.Model):
    _name = 'erpv6.call.log'
    _description = 'Log di una chiamata (live o retroattiva)'
    _order = 'started_at desc'

    name = fields.Char(compute='_compute_name', store=True)

    partner_id = fields.Many2one(
        'res.partner', string='Azienda/Contatto',
        required=True, ondelete='cascade', index=True)
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        help='Contesto progetto/sotto-progetto della call.')
    lead_id = fields.Many2one(
        'erpv6.acquisition.lead', string='Lead pipeline',
        help='Se la call riguarda un lead in pipeline acquisizione.')

    user_id = fields.Many2one(
        'res.users', string='Operatore',
        default=lambda self: self.env.uid, required=True)

    started_at = fields.Datetime(default=fields.Datetime.now, required=True)
    ended_at = fields.Datetime()
    duration_minutes = fields.Integer(
        compute='_compute_duration', store=True, string='Durata (min)')

    state = fields.Selection([
        ('live', 'In corso'),
        ('done', 'Conclusa'),
    ], default='live', required=True)

    notes = fields.Text(help='Consolidato finale delle note (snapshot)')
    outcomes = fields.Text(help='Sbocchi commerciali in chiaro')

    note_ids = fields.One2many(
        'erpv6.call.note', 'call_id', string='Note live')

    @api.depends('partner_id', 'started_at')
    def _compute_name(self):
        for rec in self:
            date = (rec.started_at or fields.Datetime.now()).strftime('%d/%m %H:%M')
            rec.name = f"Call {rec.partner_id.name or '?'} — {date}"

    @api.depends('started_at', 'ended_at')
    def _compute_duration(self):
        for rec in self:
            if rec.started_at and rec.ended_at:
                delta = rec.ended_at - rec.started_at
                rec.duration_minutes = int(delta.total_seconds() // 60)
            else:
                rec.duration_minutes = 0

    def action_end(self):
        """Chiude la call: setta ended_at, consolida le note nel campo notes."""
        for rec in self:
            rec.ended_at = fields.Datetime.now()
            rec.state = 'done'
            rec.notes = '\n'.join(
                f"[{n.captured_at.strftime('%H:%M') if n.captured_at else '--:--'}] {n.body}"
                for n in rec.note_ids.sorted('captured_at')
            )
        return True
