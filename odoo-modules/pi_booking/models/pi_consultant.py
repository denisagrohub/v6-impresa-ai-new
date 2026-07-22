from odoo import models, fields

class ResPartner(models.Model):
    _inherit = 'res.partner'

    x_pi_is_consultant = fields.Boolean(
        string='È un Consulente PI',
        default=False,
        help='Indica se questo partner è un consulente di Progetto Impresa'
    )
    x_pi_consultant_brand = fields.Char(
        string='Brand Consulente',
        default='progetto-impresa'
    )
    x_pi_hourly_rate = fields.Float(
        string='Tariffa Oraria (€)',
        default=0.0,
        help='Tariffa oraria del consulente'
    )
    x_pi_max_daily_public_slots = fields.Integer(
        string='Max Slot Pubblici/Giorno',
        default=3,
        help='Numero massimo di slot pubblici che il consulente può pubblicare al giorno'
    )
    x_pi_google_calendar_id = fields.Char(
        string='Google Calendar ID',
        help='ID del calendario Google per sync bidirezionale'
    )
    x_pi_google_sync_enabled = fields.Boolean(
        string='Sync Google Attivo',
        default=False
    )