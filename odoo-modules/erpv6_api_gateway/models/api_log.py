from odoo import fields, models


class ApiLog(models.Model):
    _name = 'erpv6.api.log'
    _description = 'Log API'
    _order = 'create_date desc'

    endpoint = fields.Char(required=True, index=True)
    method = fields.Selection([('GET','GET'),('POST','POST'),('PUT','PUT'),('DELETE','DELETE')], required=True)
    user_id = fields.Many2one('res.users')
    status_code = fields.Integer()
    response_time_ms = fields.Integer()
    ip_address = fields.Char(size=45)
    user_agent = fields.Char()
    create_date = fields.Datetime(default=fields.Datetime.now, index=True)
