from odoo import fields, models


class GenerateBulkWizard(models.TransientModel):
    _name = 'erpv6.booking.token.generate.bulk.wizard'
    _description = 'Wizard Generazione Token Multipli'

    consultant_id = fields.Many2one('erpv6.consulting.consultant', required=True)
    count = fields.Integer('Numero Token', default=10, required=True)
    validity_hours = fields.Integer('Validita (ore)', default=24, required=True)

    def action_generate(self):
        self.ensure_one()
        self.env['erpv6.booking.token'].generate_bulk(
            self.consultant_id.id, self.count, self.validity_hours,
        )
        return {'type': 'ir.actions.act_window_close'}
