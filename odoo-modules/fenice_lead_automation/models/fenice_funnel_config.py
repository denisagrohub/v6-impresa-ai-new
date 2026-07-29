from odoo import models, fields, api

class FeniceFunnelConfig(models.Model):
    _name = 'fenice.funnel.config'
    _description = 'Configurazione Funnel Email Fenice'

    name = fields.Char(string='Nome Configurazione', required=True, default='Configurazione Attiva')
    is_active = fields.Boolean(string='Attiva', default=True)
    delay_email_2 = fields.Integer(string='Giorni prima Email 2', default=2)
    delay_email_3 = fields.Integer(string='Giorni prima Email 3', default=5)
    delay_email_4 = fields.Integer(string='Giorni prima Email 4', default=10)
    delay_email_5 = fields.Integer(string='Giorni prima Email 5', default=20)
    
    template_email_1 = fields.Many2one('mail.template', string='Template Email 1')
    template_email_2 = fields.Many2one('mail.template', string='Template Email 2')
    template_email_3 = fields.Many2one('mail.template', string='Template Email 3')
    template_email_4 = fields.Many2one('mail.template', string='Template Email 4')
    template_email_5 = fields.Many2one('mail.template', string='Template Email 5')
