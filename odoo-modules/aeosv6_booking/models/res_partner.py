from odoo import models, fields

class ResPartner(models.Model):
    _inherit = 'res.partner'
    x_pi_is_consultant = fields.Boolean('È un Consulente PI', default=False)
    x_pi_consultant_brand = fields.Char('Brand Consulente', default='progetto-impresa')
    x_pi_hourly_rate = fields.Float('Tariffa Oraria (€)', default=0.0)
    x_pi_max_daily_public_slots = fields.Integer('Max Slot Pubblici/Giorno', default=3)
