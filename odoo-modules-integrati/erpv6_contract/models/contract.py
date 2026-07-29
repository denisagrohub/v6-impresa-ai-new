from odoo import api, fields, models

class Erpv6Contract(models.Model):
    _name = 'erpv6.contract'
    _description = 'Contratto'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(required=True, tracking=True)
    partner_id = fields.Many2one('res.partner', required=True, tracking=True)
    project_id = fields.Many2one('project.project')
    package_id = fields.Many2one('erpv6.package.custom')
    document_ids = fields.One2many('erpv6.contract.document', 'contract_id')
    
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('sent', 'Inviato'),
        ('signed', 'Firmato'),
        ('certified', 'Certificato'),
        ('expired', 'Scaduto'),
    ], default='draft', tracking=True)
    
    signed_at = fields.Datetime()
    signature_hash = fields.Char()
    blockchain_hash = fields.Char()
    is_certified = fields.Boolean(default=False)
