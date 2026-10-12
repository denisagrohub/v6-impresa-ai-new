# pylint: disable=import-error
"""Firma email multi-scope (C-email-settings-1 sessione A).

Modello erpv6.email.signature (3 scope: company | project | user).
Cascata: user > project > company. Logo da res.company.logo ad ogni
invio (zero cache). Disclaimer configurabile.

Helper build_signature(user, relation) ritorna HTML completo
(logo + firma + disclaimer). Integrato in 3 punti invio
user-initiated (email_hub.reply, admin.send, consultant.send).
NON usato da watcher/kaizen (email automatiche).
"""
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class Erpv6EmailSignature(models.Model):
    _name = 'erpv6.email.signature'
    _description = 'Firma email V6 (multi-scope)'
    _order = 'scope, sequence, name'

    scope = fields.Selection([
        ('company', 'Aziendale'),
        ('project', 'Progetto'),
        ('user', 'Personale'),
    ], string='Scope', required=True, default='company', index=True)

    name = fields.Char(
        string='Nome', required=True,
        help='Etichetta interna (es. "Firma V6 standard")')

    signature_html = fields.Html(
        string='Firma',
        help='Corpo firma. Il logo è aggiunto automaticamente.')

    disclaimer_html = fields.Html(
        string='Disclaimer riservatezza')

    disclaimer_enabled = fields.Boolean(
        string='Disclaimer attivo', default=True)

    # Target per scope
    company_id = fields.Many2one(
        'res.company', string='Azienda', ondelete='cascade')
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto', ondelete='cascade')
    user_id = fields.Many2one(
        'res.users', string='Utente', ondelete='cascade')

    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=10)

    @api.constrains('scope', 'company_id', 'relation_id', 'user_id')
    def _check_scope_target(self):
        for r in self:
            if r.scope == 'company' and not r.company_id:
                raise ValidationError('Scope company richiede company_id')
            if r.scope == 'project' and not r.relation_id:
                raise ValidationError('Scope project richiede relation_id')
            if r.scope == 'user' and not r.user_id:
                raise ValidationError('Scope user richiede user_id')

    @api.model
    def get_or_create_logo_attachment(self):
        """12/10/2026 (C-email-settings-1): attachment condiviso per
        logo email con cid: inline (funziona su client esterni).

        Naming: logo_v6_<md5_8>.png (md5 di res.company.logo).
        Linkato a res.company (protetto da GC).
        Quando il logo cambia, nuovo attachment -> vecchi eliminati.
        Ritorna ir.attachment o recordset vuoto.
        """
        import hashlib
        Company = self.env.company
        ICP = self.env['ir.config_parameter'].sudo()
        logo_enabled = (
            ICP.get_param('email.logo_enabled', 'True') or 'True'
        ) == 'True'
        if not logo_enabled or not Company.logo:
            return self.env['ir.attachment']
        try:
            logo_bytes = Company.logo
            if isinstance(logo_bytes, str):
                import base64 as _b64
                logo_bytes = _b64.b64decode(logo_bytes)
            md5 = hashlib.md5(logo_bytes).hexdigest()[:8]
        except Exception:
            _logger.exception('md5 logo fallito')
            return self.env['ir.attachment']
        fname = 'logo_v6_%s.png' % md5
        Att = self.env['ir.attachment'].sudo()
        att = Att.search([
            ('name', '=', fname),
            ('res_model', '=', 'res.company'),
            ('res_id', '=', Company.id),
        ], limit=1)
        if not att:
            import base64 as _b64
            att = Att.create({
                'name': fname,
                'datas': _b64.b64encode(logo_bytes),
                'mimetype': 'image/png',
                'res_model': 'res.company',
                'res_id': Company.id,
            })
            # Cleanup vecchi logo_v6_*.png
            old = Att.search([
                ('name', 'like', 'logo_v6_%'),
                ('name', '!=', fname),
                ('res_model', '=', 'res.company'),
                ('res_id', '=', Company.id),
            ])
            if old:
                old.unlink()
        return att

    @api.model
    def build_signature(self, user, relation=None):
        """Ritorna (html, logo_attachment_or_None).

        HTML include logo cid: se l'attachment è disponibile.
        Cascata firma: user > project > company.
        """
        Company = self.env.company
        ICP = self.env['ir.config_parameter'].sudo()
        parts = []
        logo_att = None

        # 1. Logo (cid: attachment inline)
        logo_att = self.get_or_create_logo_attachment()
        if logo_att:
            max_h = ICP.get_param('email.logo_max_height', '80') or '80'
            parts.append(
                '<div style="margin-bottom:16px;">'
                '<img src="cid:%s" '
                'style="max-height:%spx;" alt="%s"/>'
                '</div>' % (logo_att.name, max_h, Company.name or '')
            )

        # 2. Firma (cascata)
        sig = None
        # 2a. user
        if user:
            sig = self.sudo().search([
                ('scope', '=', 'user'),
                ('user_id', '=', user.id),
                ('active', '=', True),
            ], order='sequence', limit=1)
        # 2b. project
        if not sig and relation:
            sig = self.sudo().search([
                ('scope', '=', 'project'),
                ('relation_id', '=', relation.id),
                ('active', '=', True),
            ], order='sequence', limit=1)
        # 2c. company
        if not sig:
            sig = self.sudo().search([
                ('scope', '=', 'company'),
                ('company_id', '=', Company.id),
                ('active', '=', True),
            ], order='sequence', limit=1)

        if sig and sig.signature_html:
            parts.append(sig.signature_html)
        else:
            # Fallback: firma minimale
            user_name = (user.partner_id.name if user and user.partner_id
                         else (user.name if user else 'V6 Impresa'))
            slug = getattr(user, 'email_slug', None) if user else None
            user_email = ('%s@v6impresa.it' % slug) if slug else 'info@v6impresa.it'
            parts.append(
                '<p style="margin:16px 0 0;">'
                '<strong>%s</strong><br/>'
                'V6 Impresa<br/>'
                '<a href="mailto:%s">%s</a>'
                '</p>' % (user_name, user_email, user_email)
            )

        # 3. Disclaimer
        disclaimer_html = (
            (sig.disclaimer_html if sig else None)
            or ICP.get_param('email.disclaimer_default', '')
        )
        disclaimer_on = sig.disclaimer_enabled if sig else True
        if disclaimer_on and disclaimer_html:
            parts.append(disclaimer_html)

        return '\n'.join(parts), (logo_att if logo_att else None)
