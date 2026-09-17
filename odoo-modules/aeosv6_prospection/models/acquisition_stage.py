from odoo import fields, models


class Erpv6AcquisitionStage(models.Model):
    _name = 'erpv6.acquisition.stage'
    _description = 'Fasi pipeline acquisizione (per progetto figlio)'
    _order = 'sequence, id'

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', required=True, ondelete='cascade',
        string='Progetto')
    is_won = fields.Boolean()
    is_lost = fields.Boolean()

    _sql_constraints = [
        ('name_relation_uniq', 'unique(relation_id, name)',
         'Fase gia esistente per questo progetto'),
    ]
