import hashlib

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

KB_TYPE_SELECTION = [
    ('fiscale', 'Fiscale'), ('psicologico', 'Psicologico'),
    ('normativo', 'Normativo'), ('industriale', 'Industriale'),
    ('artigianale', 'Artigianale'), ('prompt', 'Prompt AI'),
    ('metodo_v6', 'Metodo V6'),
]


class Erpv6KnowledgeBase(models.Model):
    _name = 'erpv6.kb'
    _description = 'Knowledge Base V6'
    _inherit = ['mail.thread', 'mail.activity.mixin', 'erpv6.version.mixin']
    _order = 'kb_type, priority desc, name'

    name = fields.Char('Titolo', required=True, tracking=True, index=True)
    description = fields.Text('Abstract')
    kb_type = fields.Selection(KB_TYPE_SELECTION, required=True, index=True, tracking=True)
    category_id = fields.Many2one('erpv6.kb.category', required=True, index=True)
    tag_ids = fields.Many2many('erpv6.kb.tag', string='Tag')
    brand_id = fields.Many2one('erpv6.consulting.brand')
    priority = fields.Integer(default=5)

    content = fields.Text(required=True)
    content_format = fields.Selection([
        ('text', 'Testo'), ('json', 'JSON'), ('yaml', 'YAML'), ('markdown', 'Markdown'),
    ], default='text', required=True)
    is_encrypted = fields.Boolean(default=False)
    checksum = fields.Char(compute='_compute_checksum', store=True)

    access_level = fields.Selection([
        ('public', 'Pubblico'), ('consultant', 'Consulenti'),
        ('ai_only', 'Solo AI'), ('admin', 'Solo Admin'),
    ], default='consultant', required=True, tracking=True)
    allowed_user_ids = fields.Many2many('res.users', string='Utenti Autorizzati')

    embedding = fields.Text('Embedding')
    use_context = fields.Text('Contesto Utilizzo')
    related_article_ids = fields.Many2many('erpv6.kb', 'kb_rel', 'article_id', 'related_id')

    use_count = fields.Integer(default=0, readonly=True)
    last_used = fields.Datetime(readonly=True)
    last_used_by = fields.Char(readonly=True)

    source = fields.Char('Fonte')
    valid_from = fields.Date()
    valid_to = fields.Date()
    is_active = fields.Boolean(default=True, index=True)

    _sql_constraints = [('name_unique', 'unique(name, kb_type)', 'Nome+tipo deve essere univoco!')]

    @api.constrains('priority')
    def _check_priority(self):
        for rec in self:
            if not 0 <= rec.priority <= 10:
                raise ValidationError(_('Priorita tra 0 e 10.'))

    @api.depends('content')
    def _compute_checksum(self):
        for rec in self:
            rec.checksum = hashlib.sha256((rec.content or '').encode()).hexdigest()

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        has_valid_to = any(isinstance(a, (list, tuple)) and len(a) >= 1 and a[0] == 'valid_to' for a in args)
        if not has_valid_to:
            args += ['|', ('valid_to', '=', False), ('valid_to', '>=', fields.Date.today())]
        return super().search(args, offset=offset, limit=limit, order=order, count=count)

    @api.model_create_multi
    def create(self, vals_list):
        crypto = self.env['erpv6.crypto.engine']
        for vals in vals_list:
            if vals.get('is_encrypted') and vals.get('content'):
                double = vals.get('kb_type') in ('prompt', 'metodo_v6')
                vals['content'] = crypto.encrypt(vals['content'], double=double, context=f'kb_create_{vals.get("kb_type")}')
        return super().create(vals_list)

    def write(self, vals):
        if 'content' in vals and self.env.context.get('encrypt_content', True):
            crypto = self.env['erpv6.crypto.engine']
            for rec in self:
                rec_vals = vals.copy()
                if rec.is_encrypted and rec_vals.get('content'):
                    if rec_vals['content'] != rec.content:
                        rec._increment_version(rec_vals.get('change_notes', 'Aggiornamento'))
                    double = rec.kb_type in ('prompt', 'metodo_v6')
                    rec_vals['content'] = crypto.encrypt(rec_vals['content'], double=double, context=f'kb_update_{rec.kb_type}')
                    super(Erpv6KnowledgeBase, rec).write(rec_vals)
                else:
                    if rec_vals.get('content') and rec_vals['content'] != rec.content:
                        rec._increment_version(rec_vals.get('change_notes', 'Aggiornamento'))
                    super(Erpv6KnowledgeBase, rec).write(rec_vals)
            return True
        return super().write(vals)

    def get_content_for_ai(self, ai_name='unknown'):
        self.ensure_one()
        if not self._check_access():
            raise UserError(_('Accesso negato.'))
        content = self.content
        if self.is_encrypted:
            content = self.env['erpv6.crypto.engine'].decrypt(content, context=f'ai_{ai_name}')
        self.write({'use_count': self.use_count + 1, 'last_used': fields.Datetime.now(), 'last_used_by': ai_name})
        return content

    def _check_access(self):
        self.ensure_one()
        if self.env.user.has_group('base.group_system'):
            return True
        if self.allowed_user_ids and self.env.user in self.allowed_user_ids:
            return True
        return self.access_level in ('public', 'consultant')

    def action_show_content(self):
        self.ensure_one()
        content = self.get_content_for_ai('ui_user')
        preview = content[:500] + '...' if isinstance(content, str) and len(content) > 500 else content
        return {'type': 'ir.actions.client', 'tag': 'display_notification',
                'params': {'title': self.name, 'message': str(preview), 'type': 'info', 'sticky': True}}

    def action_log_usage(self, ai_name='manual'):
        for rec in self:
            rec.write({'use_count': rec.use_count + 1, 'last_used': fields.Datetime.now(), 'last_used_by': ai_name})
