from odoo import api, fields, models


class Erpv6CoreTracked(models.AbstractModel):
    _name = 'erpv6.core.tracked'
    _description = 'Mixin per tracciabilità base su tutti i modelli V6'
    _inherit = ['mail.thread']

    # Campo active standard per gestione record archiviati/attivi
    active = fields.Boolean(default=True, index=True, tracking=True)

    # I campi create_date, write_date, create_uid, write_uid sono nativi di Odoo
    # Questo mixin garantisce coerenza nel tracking via chatter e active flag
