from odoo import api, fields, models


class Erpv6KbTag(models.Model):
    _name = 'erpv6.kb.tag'
    _description = 'Tag KB'
    _order = 'name'

    name = fields.Char(required=True, translate=True, index=True)
    color = fields.Integer(default=1)
    active = fields.Boolean(default=True)
    article_count = fields.Integer(compute='_compute_count')

    @api.depends('name')
    def _compute_count(self):
        for tag in self:
            tag.article_count = self.env['erpv6.kb'].search_count([('tag_ids', 'in', tag.id)])
