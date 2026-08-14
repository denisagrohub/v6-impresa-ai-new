from odoo import models, fields


class BrandProjectLibrary(models.Model):
    _inherit = 'erpv6.brand.project'

    selected_logo_asset_id = fields.Many2one(
        'erpv6.library.document',
        string='Logo Finale',
        help='Riferimento all\'asset logo finale in library'
    )
