from odoo import api, fields, models

class Erpv6ContractDocument(models.Model):
    _name = 'erpv6.contract.document'
    _description = 'Documento Contrattuale'

    name = fields.Char(required=True)
    contract_id = fields.Many2one('erpv6.contract')
    doc_type = fields.Selection([
        ('nda', 'NDA'),
        ('service', 'Contratto'),
        ('terms', 'Termini'),
        ('privacy', 'Privacy'),
        ('custom', 'Custom'),
    ], required=True)
    content = fields.Binary()
    file_name = fields.Char()
    hash = fields.Char()
    signed_by = fields.Many2one('res.users')
    signed_at = fields.Datetime()
    signature_hash = fields.Char()
    blockchain_hash = fields.Char()
    is_certified = fields.Boolean(default=False)
