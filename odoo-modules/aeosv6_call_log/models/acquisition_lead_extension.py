from odoo import fields, models


class Erpv6AcquisitionLeadExtension(models.Model):
    _inherit = 'erpv6.acquisition.lead'

    call_id = fields.Many2one(
        'erpv6.call.log', string='Call di origine',
        help='La call da cui è nato questo lead (Denis, 18/09/2026).')
