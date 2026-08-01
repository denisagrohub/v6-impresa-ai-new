from odoo import api, fields, models
from .kb_knowledge import KB_TYPE_SELECTION


class Erpv6KbCategory(models.Model):
    _name = 'erpv6.kb.category'
    _description = 'Categoria KB'
    _order = 'kb_type, sequence, name'

    name = fields.Char(required=True, translate=True)
    kb_type = fields.Selection(KB_TYPE_SELECTION, required=True, index=True)
    description = fields.Text(translate=True)
    parent_id = fields.Many2one('erpv6.kb.category')
    child_ids = fields.One2many('erpv6.kb.category', 'parent_id')
    sequence = fields.Integer(default=10)
    color = fields.Integer(default=1)
    active = fields.Boolean(default=True)
    article_count = fields.Integer(compute='_compute_article_count')
    
    # Campo per TTL cache su istanze child SaaS
    default_ttl_hours = fields.Integer(string='TTL Cache Default (ore)', default=24, 
                                       help='Per categorie consumate da child SaaS: quante ore un dato resta valido in cache prima di richiedere un refresh dal parent')

    @api.depends('name')
    def _compute_article_count(self):
        for cat in self:
            cat.article_count = self.env['erpv6.kb'].search_count([('category_id', '=', cat.id)])
