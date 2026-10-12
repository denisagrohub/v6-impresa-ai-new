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
        logo email (inline via Content-ID).

        NOTA CRITICA: res.company.logo è BINARY Odoo: internamente
        contiene bytes ASCII di una stringa base64 (non PNG raw).
        Quindi:
          - per md5: decode ascii -> b64decode -> hash del PNG vero
          - per datas ir.attachment: usare la stringa base64 AS-IS
            (NON ricodificare, evita doppio encoding).

        Naming: logo_v6_<md5_8>.png. Idempotente.
        Cleanup automatico vecchi logo_v6_* al cambio logo.
        """
        import hashlib
        import base64 as _b64
        Company = self.env.company
        ICP = self.env['ir.config_parameter'].sudo()
        logo_enabled = (
            ICP.get_param('email.logo_enabled', 'True') or 'True'
        ) == 'True'
        if not logo_enabled or not Company.logo:
            return self.env['ir.attachment']

        try:
            raw = Company.logo
            # raw è bytes con base64 ASCII dentro
            if isinstance(raw, bytes):
                b64_str = raw.decode('ascii')
            else:
                b64_str = raw
            # md5 del PNG reale (decodificato)
            png_bytes = _b64.b64decode(b64_str)
            md5 = hashlib.md5(png_bytes).hexdigest()[:8]
        except Exception:
            _logger.exception('logo decode/md5 fallito')
            return self.env['ir.attachment']

        fname = 'logo_v6_%s.png' % md5
        Att = self.env['ir.attachment'].sudo()
        att = Att.search([
            ('name', '=', fname),
            ('res_model', '=', 'res.company'),
            ('res_id', '=', Company.id),
        ], limit=1)
        if not att:
            import secrets
            att = Att.create({
                'name': fname,
                'datas': b64_str,  # AS-IS: già base64
                'mimetype': 'image/png',
                'res_model': 'res.company',
                'res_id': Company.id,
                'public': True,
                'access_token': secrets.token_urlsafe(24),
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

        12/10/2026 (fix Q1-Q5 master): firma COMPOSITIVA a strati.

        Struttura:
          [corpo email]
          <div firma>
            [LOGO]                       <- in cima alla firma
            [firma USER]                 <- sempre (fallback auto)
            —  (em-dash)
            [firma PROJECT]              <- se relation + record custom
            —  (em-dash)
            [firma COMPANY]              <- sempre
            <hr> (company->disclaimer)
            [disclaimer]                 <- user/project/company/default
          </div>
        """
        Company = self.env.company
        ICP = self.env['ir.config_parameter'].sudo()
        parts = []

        # Wrapper firma
        parts.append(
            '<div style="margin-top:24px;font-family:Arial,Helvetica,'
            'sans-serif;font-size:13px;color:#333;line-height:1.45;">'
        )

        # ── 1. LOGO (in cima alla firma, non in cima all'email)
        logo_att = self.get_or_create_logo_attachment()
        if logo_att:
            max_h = ICP.get_param('email.logo_max_height', '80') or '80'
            base_url = (ICP.get_param('web.base.url') or '').rstrip('/')
            img_url = '%s/web/image/%s/%s?access_token=%s' % (
                base_url, logo_att.id, logo_att.name,
                logo_att.access_token or '')
            parts.append(
                '<div style="margin-bottom:14px;">'
                '<img src="%s" style="max-height:%spx;border:0;" alt="%s"/>'
                '</div>' % (img_url, max_h, Company.name or '')
            )

        # ── 2. FIRMA USER (sempre)
        user_sig = None
        if user:
            user_sig = self.sudo().search([
                ('scope', '=', 'user'),
                ('user_id', '=', user.id),
                ('active', '=', True),
            ], order='sequence', limit=1)

        if user_sig and user_sig.signature_html:
            parts.append(user_sig.signature_html)
        elif user:
            user_name = (user.partner_id.name if user.partner_id
                         else (user.name or ''))
            slug = getattr(user, 'email_slug', None)
            if slug:
                user_email = '%s@v6impresa.it' % slug
            elif user.partner_id and user.partner_id.email:
                user_email = user.partner_id.email
            else:
                user_email = ''
            email_line = ''
            if user_email:
                email_line = (
                    '<a href="mailto:%s" style="color:#0066cc;'
                    'text-decoration:none;">%s</a>' % (user_email, user_email)
                )
            parts.append(
                '<p style="margin:0 0 4px;">'
                '<strong>%s</strong>%s'
                '</p>' % (
                    user_name or '',
                    ('<br/>' + email_line) if email_line else '',
                )
            )

        # ── 3. FIRMA PROJECT (se relation + record custom)
        project_sig = None
        if relation:
            project_sig = self.sudo().search([
                ('scope', '=', 'project'),
                ('relation_id', '=', relation.id),
                ('active', '=', True),
            ], order='sequence', limit=1)
        if project_sig and project_sig.signature_html:
            parts.append('<p style="margin:8px 0;color:#bbb;">—</p>')
            parts.append(project_sig.signature_html)

        # ── 4. FIRMA COMPANY (sempre)
        company_sig = self.sudo().search([
            ('scope', '=', 'company'),
            ('company_id', '=', Company.id),
            ('active', '=', True),
        ], order='sequence', limit=1)
        parts.append('<p style="margin:8px 0;color:#bbb;">—</p>')
        if company_sig and company_sig.signature_html:
            parts.append(company_sig.signature_html)
        else:
            parts.append(
                '<p style="margin:0;">'
                '<strong>%s</strong><br/>'
                '<a href="https://www.v6impresa.it" style="color:#0066cc;'
                'text-decoration:none;">www.v6impresa.it</a>'
                '</p>' % (Company.name or 'V6 Impresa')
            )

        # ── 5. DISCLAIMER
        disclaimer_html = None
        disclaimer_on = True
        if user_sig and user_sig.disclaimer_html:
            disclaimer_html = user_sig.disclaimer_html
            disclaimer_on = user_sig.disclaimer_enabled
        elif project_sig and project_sig.disclaimer_html:
            disclaimer_html = project_sig.disclaimer_html
            disclaimer_on = project_sig.disclaimer_enabled
        elif company_sig and company_sig.disclaimer_html:
            disclaimer_html = company_sig.disclaimer_html
            disclaimer_on = company_sig.disclaimer_enabled
        else:
            disclaimer_html = ICP.get_param('email.disclaimer_default', '')

        if disclaimer_on and disclaimer_html:
            parts.append(
                '<hr style="border:none;border-top:1px solid #e0e0e0;'
                'margin:12px 0 8px;"/>'
            )
            parts.append(disclaimer_html)

        parts.append('</div>')

        return '\n'.join(parts), (logo_att if logo_att else None)
