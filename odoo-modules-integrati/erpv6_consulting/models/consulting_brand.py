from odoo import api, fields, models


class ConsultingBrand(models.Model):
    _name = 'erpv6.consulting.brand'
    _description = 'Brand di Consulting'

    name = fields.Char('Nome Brand', required=True)
    code = fields.Char('Codice Brand', required=True)
    active = fields.Boolean('Attivo', default=True)
    color = fields.Char('Colore Primario', default='#1a2744')
    default_hourly_rate = fields.Float('Tariffa Oraria Default', default=150.0)
    default_commission_rate = fields.Float('Provvigione Default (%)', default=10.0)
    description = fields.Text('Descrizione')
    consultant_ids = fields.One2many('erpv6.consulting.consultant', 'brand_id', string='Consulenti')
    consultant_count = fields.Integer('N. Consulenti', compute='_compute_consultant_count')

    _sql_constraints = [('code_unique', 'unique(code)', 'Codice brand univoco!')]

    @api.depends('consultant_ids')
    def _compute_consultant_count(self):
        for brand in self:
            brand.consultant_count = len(brand.consultant_ids)
