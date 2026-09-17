from odoo import api, fields, models


PROMOTED_TO = [
    ('none', '—'),
    ('scouting_identita', 'Scouting → Identità'),
    ('scouting_finanza', 'Scouting → Finanza'),
    ('scouting_posizionamento', 'Scouting → Posizionamento'),
    ('scouting_fit', 'Scouting → Fit'),
    ('outcome', 'Sbocco commerciale'),
    ('lead_note', 'Nota lead'),
]


class Erpv6CallNote(models.Model):
    _name = 'erpv6.call.note'
    _description = 'Nota presa durante una call'
    _order = 'captured_at asc'

    call_id = fields.Many2one(
        'erpv6.call.log', required=True, ondelete='cascade', index=True)
    body = fields.Text(required=True)
    captured_at = fields.Datetime(default=fields.Datetime.now, required=True)

    promoted_to = fields.Selection(PROMOTED_TO, default='none')
    promoted_field = fields.Char(
        help='Nome del campo dentro la sezione scouting (es. fatturatoMln)')
