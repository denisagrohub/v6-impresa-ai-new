from odoo import models, fields, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Boolean fields per ogni tipologia di tracking
    tracking_enabled_product = fields.Boolean(
        string='Traccia Prodotti',
        config_parameter='tracking.enabled.product',
        help='Abilita la tracciabilità per i prodotti'
    )
    tracking_enabled_document = fields.Boolean(
        string='Traccia Documenti',
        config_parameter='tracking.enabled.document',
        help='Abilita la tracciabilità per i documenti'
    )
    tracking_enabled_project = fields.Boolean(
        string='Traccia Progetti',
        config_parameter='tracking.enabled.project',
        help='Abilita la tracciabilità per i progetti'
    )
    tracking_enabled_order = fields.Boolean(
        string='Traccia Ordini',
        config_parameter='tracking.enabled.order',
        help='Abilita la tracciabilità per gli ordini'
    )
    tracking_enabled_custom = fields.Boolean(
        string='Traccia Custom',
        config_parameter='tracking.enabled.custom',
        help='Abilita la tracciabilità per elementi custom'
    )
