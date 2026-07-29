from odoo import api, fields, models


class SignLog(models.Model):
    _name = 'erpv6.sign.log'
    _description = 'Log Firma Elettronica'
    _order = 'create_date desc'

    request_id = fields.Many2one('erpv6.sign.request', string='Richiesta', ondelete='cascade')
    action = fields.Char(string='Azione', required=True)
    details = fields.Text(string='Dettagli')
    create_date = fields.Datetime(string='Data', default=fields.Datetime.now)
