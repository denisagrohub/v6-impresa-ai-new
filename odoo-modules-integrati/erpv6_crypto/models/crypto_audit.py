from odoo import api, fields, models


class Erpv6CryptoAudit(models.Model):
    _name = 'erpv6.crypto.audit'
    _description = 'Audit di Crittografia'
    _order = 'create_date desc'

    user_id = fields.Many2one('res.users', required=True)
    operation = fields.Selection([
        ('encrypt', 'Cifratura'), ('decrypt', 'Decifratura'), ('rotate', 'Rotazione'),
    ], required=True, index=True)
    context = fields.Text()
    data_length = fields.Integer()
    ip_address = fields.Char(size=45)
    create_date = fields.Datetime(default=fields.Datetime.now, index=True)
