from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
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
    
    # TASK 1 - Distinzione trasversale/verticale
    is_transversal = fields.Boolean(
        string='Trasversale a tutti i verticali',
        default=False,
        help='True per conoscenza applicabile a qualsiasi settore (es. psicologia, DISC, pattern comunicativi). False per conoscenza specifica di un verticale.'
    )
    verticale = fields.Char(
        string='Verticale di Riferimento',
        help="Solo se is_transversal=False. Es: 'agricolo', 'vitivinicolo', 'falegnameria', 'illuminazione'"
    )

    @api.constrains('is_transversal', 'verticale')
    def _check_transversal_verticale_exclusive(self):
        for rec in self:
            if rec.is_transversal and rec.verticale:
                raise ValidationError(
                    _("Una categoria trasversale non può avere un verticale di riferimento specificato. "
                      "Se is_transversal=True, il campo verticale deve essere vuoto.")
                )

    @api.depends('name')
    def _compute_article_count(self):
        for cat in self:
            cat.article_count = self.env['erpv6.kb'].search_count([('category_id', '=', cat.id)])

    @api.model
    def get_or_create(self, name, kb_type, **extra_vals):
        """Get-or-create per (name, kb_type) -- stessa chiave logica riusata sia
        dall'estrazione KB (erpv6_omni_bridge, categoria di staging) sia dallo
        spostamento nella categoria reale all'approvazione 6 Giudici
        (erpv6_production/models/validation_session.py), per non duplicare la
        stessa ricerca in due moduli diversi."""
        category = self.search([('name', '=', name), ('kb_type', '=', kb_type)], limit=1)
        if not category:
            category = self.create(dict(extra_vals, name=name, kb_type=kb_type))
        return category
