from odoo import models, fields

class FeniceFunnelStep(models.Model):
    _name = 'fenice.funnel.step'
    _description = 'Step del Funnel Email'
    _order = 'sequence, id'

    sequence = fields.Integer(string='Sequenza', default=10)
    name = fields.Char(string='Nome Step', required=True)
    days_delay = fields.Integer(string='Giorni di Attesa', required=True)
    email_template_id = fields.Many2one('mail.template', string='Template Email')
