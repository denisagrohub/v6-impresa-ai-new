import hashlib

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

KB_TYPE_SELECTION = [
    ('fiscale', 'Fiscale'), ('psicologico', 'Psicologico'),
    ('normativo', 'Normativo'), ('industriale', 'Industriale'),
    ('artigianale', 'Artigianale'), ('prompt', 'Prompt AI'),
    ('metodo_v6', 'Metodo V6'),
    ('changelog_tecnico', 'Changelog Tecnico (specchio memoria sviluppo, mai per il motore)'),
]

# kb_type esclusi per costruzione da find_best_for(), indipendentemente da
# is_active o da cosa un chiamante futuro passi per errore -- specchio
# leggibile della memoria di sviluppo (bug trovati, fix applicati, esiti
# verificati), concettualmente diverso dalla KB di business che il motore
# usa per rispondere ai clienti. Vedi find_best_for() sotto.
KB_TYPE_EXCLUDED_FROM_ENGINE = {'changelog_tecnico'}


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
    
    # Gerarchia KB (separata da related_article_ids)
    parent_id = fields.Many2one('erpv6.kb', string='KB Padre', index=True, tracking=True)
    child_ids = fields.One2many('erpv6.kb', 'parent_id', string='KB Figlie')
    normalized_data = fields.Text(string='Dati Normalizzati (JSON)')

    use_count = fields.Integer(default=0, readonly=True)
    last_used = fields.Datetime(readonly=True)
    last_used_by = fields.Char(readonly=True)

    source = fields.Char('Fonte')
    valid_from = fields.Date()
    valid_to = fields.Date()
    is_active = fields.Boolean(default=True, index=True)

    suggested_category_name = fields.Char(
        string='Categoria suggerita (AI)',
        help="Categoria proposta dall'estrazione AI al momento della creazione, prima "
             "della validazione 6 Giudici -- la voce viene creata nella categoria di "
             "transito 'KB estratte — in attesa di validazione' e spostata qui solo se "
             "approvata (vedi action_human_approve in "
             "erpv6_production/models/validation_session.py). Vuoto per voci create "
             "manualmente al di fuori del flusso di estrazione AI.")

    extracted_triples = fields.Json(
        string='Triple Estratte (AI)', default=list,
        help="Fase 1C.2 del knowledge graph erpv6 (vedi docs/PLAN_knowledge_graph_phase1.md): "
             "lista di relazioni {subject_type, subject, predicate, object_type, object, "
             "attributes} trovate dall'AI nel testo sorgente al momento dell'estrazione "
             "(erpv6_omni_bridge/models/kb_extraction_service.py), gia' filtrate lato Python "
             "sul vocabolario controllato (ALLOWED_TRIPLE_SHAPES) -- mai un tipo/predicato "
             "fuori lista. Vuoto per voci create manualmente o estratte prima di questa fase. "
             "Nessuna scrittura su nodi/archi reali del grafo: viaggia solo dentro questo "
             "record erpv6.kb, che resta is_active=False finche' non passa dal gate "
             "erpv6_validation (6 Giudici) come qualsiasi altra voce estratta.")

    prompt_approval_state = fields.Selection([
        ('none', 'Nessuna modifica in sospeso'),
        ('pending', 'In attesa di approvazione admin'),
    ], default='none', readonly=True, tracking=True,
        help="Solo per kb_type='prompt': una modifica al contenuto proposta da un "
             "utente non admin (base.group_system) non viene applicata subito ma "
             "resta qui in sospeso finche' un admin non la approva o rifiuta (vedi "
             "action_approve_pending_prompt/action_reject_pending_prompt). Un admin "
             "che modifica direttamente il contenuto bypassa questo gate.")
    prompt_pending_content = fields.Text(string='Modifica proposta (in attesa)', readonly=True)
    prompt_pending_author_id = fields.Many2one('res.users', string='Proposta da', readonly=True)
    prompt_pending_since = fields.Datetime(string='In attesa dal', readonly=True)

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
    def search(self, args, offset=0, limit=None, order=None):
        has_valid_to = any(isinstance(a, (list, tuple)) and len(a) >= 1 and a[0] == 'valid_to' for a in args)
        if not has_valid_to:
            args = args + ['|', ('valid_to', '=', False), ('valid_to', '>=', fields.Date.today())]
        return super().search(args, offset=offset, limit=limit, order=order)

    @api.model_create_multi
    def create(self, vals_list):
        crypto = self.env['erpv6.crypto.engine']
        for vals in vals_list:
            if vals.get('is_encrypted') and vals.get('content'):
                double = vals.get('kb_type') in ('prompt', 'metodo_v6')
                vals['content'] = crypto.encrypt(vals['content'], double=double, context=f'kb_create_{vals.get("kb_type")}')
        return super().create(vals_list)

    def _post_prompt_gate_notification(self, body):
        """message_post richiede un mittente con email configurata
        (raise_on_email=True in mail.thread) -- un utente/account API senza
        email non deve mai impedire il salvataggio della proposta o
        l'approvazione/rifiuto, che sono la garanzia vera del gate. La
        notifica in chatter e' un di piu', non deve mai bloccare."""
        try:
            self.message_post(body=body)
        except UserError:
            pass

    def write(self, vals):
        if 'content' in vals and self.env.context.get('encrypt_content', True):
            is_admin = self.env.user.has_group('base.group_system')
            crypto = self.env['erpv6.crypto.engine']
            for rec in self:
                if rec.kb_type == 'prompt' and not is_admin:
                    # Gate di approvazione: un non-admin non scrive mai il contenuto
                    # di un prompt AI direttamente, la modifica resta in sospeso
                    # finche' un admin non la approva (action_approve_pending_prompt).
                    proposed = vals.get('content')
                    rec_vals = {k: v for k, v in vals.items() if k != 'content'}
                    is_change = proposed is not None and proposed != rec.content
                    if is_change:
                        rec_vals.update({
                            'prompt_pending_content': proposed,
                            'prompt_pending_author_id': self.env.user.id,
                            'prompt_pending_since': fields.Datetime.now(),
                            'prompt_approval_state': 'pending',
                        })
                    super(Erpv6KnowledgeBase, rec).write(rec_vals)
                    if is_change:
                        rec._post_prompt_gate_notification(_(
                            "%(user)s ha proposto una modifica al contenuto di questo "
                            "prompt AI: in attesa di approvazione admin."
                        ) % {'user': self.env.user.name})
                    continue
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
                if rec.kb_type == 'prompt' and rec.prompt_approval_state == 'pending':
                    # L'admin ha scritto direttamente il contenuto: la sua modifica
                    # e' gia' applicata, la proposta in sospeso (se c'era) e' superata.
                    super(Erpv6KnowledgeBase, rec).write({
                        'prompt_pending_content': False,
                        'prompt_pending_author_id': False,
                        'prompt_pending_since': False,
                        'prompt_approval_state': 'none',
                    })
            return True
        return super().write(vals)

    def action_approve_pending_prompt(self):
        for rec in self:
            if not self.env.user.has_group('base.group_system'):
                raise UserError(_("Solo un admin puo' approvare la modifica di un prompt AI."))
            if rec.prompt_approval_state != 'pending':
                raise UserError(_("Nessuna modifica in sospeso da approvare per '%s'.") % rec.name)
            proposed = rec.prompt_pending_content
            author = rec.prompt_pending_author_id
            rec.write({'content': proposed, 'change_notes': _('Approvata da admin (proposta da %s)') % (author.name if author else '?')})
            rec._post_prompt_gate_notification(_(
                "%(admin)s ha approvato la modifica proposta da %(author)s: contenuto aggiornato."
            ) % {'admin': self.env.user.name, 'author': author.name if author else '?'})

    def action_reject_pending_prompt(self):
        for rec in self:
            if not self.env.user.has_group('base.group_system'):
                raise UserError(_("Solo un admin puo' rifiutare la modifica di un prompt AI."))
            if rec.prompt_approval_state != 'pending':
                raise UserError(_("Nessuna modifica in sospeso da rifiutare per '%s'.") % rec.name)
            author = rec.prompt_pending_author_id
            rec.write({
                'prompt_pending_content': False,
                'prompt_pending_author_id': False,
                'prompt_pending_since': False,
                'prompt_approval_state': 'none',
            })
            rec._post_prompt_gate_notification(_(
                "%(admin)s ha rifiutato la modifica proposta da %(author)s: contenuto invariato."
            ) % {'admin': self.env.user.name, 'author': author.name if author else '?'})

    def get_content_for_ai(self, ai_name='unknown'):
        self.ensure_one()
        # Controllo accesso: admin o utenti autorizzati o livello pubblico/consultant
        if not self.env.user.has_group('base.group_system'):
            if self.allowed_user_ids and self.env.user not in self.allowed_user_ids:
                if self.access_level not in ('public', 'consultant'):
                    raise UserError(_('Accesso negato.'))
        content = self.content
        if self.is_encrypted:
            content = self.env['erpv6.crypto.engine'].decrypt(content, context=f'ai_{ai_name}')
        self.write({'use_count': self.use_count + 1, 'last_used': fields.Datetime.now(), 'last_used_by': ai_name})
        return content

    def action_show_content(self):
        self.ensure_one()
        content = self.get_content_for_ai('ui_user')
        preview = content[:500] + '...' if isinstance(content, str) and len(content) > 500 else content
        return {'type': 'ir.actions.client', 'tag': 'display_notification',
                'params': {'title': self.name, 'message': str(preview), 'type': 'info', 'sticky': True}}

    def action_log_usage(self, ai_name='manual'):
        for rec in self:
            rec.write({'use_count': rec.use_count + 1, 'last_used': fields.Datetime.now(), 'last_used_by': ai_name})

    @api.model
    def find_best_for(self, kb_type, verticale=None, category_hint=None, tags=None):
        """Trova la KB piu' specifica per kb_type/verticale. Ritorna un id o False."""
        if kb_type in KB_TYPE_EXCLUDED_FROM_ENGINE:
            return False
        base_domain = [('kb_type', '=', kb_type), ('is_active', '=', True)]
        candidates = self.search(base_domain)
        if not candidates:
            return False
        if verticale:
            specific = candidates.filtered(lambda kb: kb.category_id.verticale == verticale)
            if specific:
                candidates = specific
            else:
                candidates = candidates.filtered(lambda kb: kb.category_id.is_transversal)
        else:
            transversal = candidates.filtered(lambda kb: kb.category_id.is_transversal)
            if transversal:
                candidates = transversal
        if not candidates:
            return False
        if category_hint and len(candidates) > 1:
            hint = category_hint.lower()
            hinted = candidates.filtered(lambda kb: hint in (kb.category_id.name or '').lower())
            if hinted:
                candidates = hinted
        if tags and len(candidates) > 1:
            tagged = candidates.filtered(lambda kb: set(kb.tag_ids.mapped('name')) & set(tags))
            if tagged:
                candidates = tagged
        return candidates[0].id
