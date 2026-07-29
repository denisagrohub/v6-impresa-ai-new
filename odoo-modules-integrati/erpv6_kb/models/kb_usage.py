from odoo import api, fields, models
class Erpv6KbUsage(models.Model):
    _name = 'erpv6.kb.usage'
    _description = 'Utilizzo KB'
    _order = 'date DESC'
    kb_id = fields.Many2one('erpv6.kb', required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', default=lambda self: self.env.user)
    date = fields.Datetime(default=fields.Datetime.now)
    action = fields.Selection([('view','Visualizzazione'),('use','Utilizzo'),('process','Elaborazione')], required=True)
    context = fields.Text()
    duration = fields.Float()
