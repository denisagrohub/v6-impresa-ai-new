from odoo import api, fields, models


class Erpv6AbstractModel(models.AbstractModel):
    _name = 'erpv6.abstract.model'
    _description = 'Abstract Model per V6'

    name = fields.Char(required=True, translate=True, index=True)
    active = fields.Boolean(default=True, index=True)
    description = fields.Text(translate=True)

    # Usa i campi nativi: create_date, write_date, create_uid, write_uid

    @api.model_create_multi
    def create(self, vals_list):
        return super().create(vals_list)

    def write(self, vals):
        return super().write(vals)
