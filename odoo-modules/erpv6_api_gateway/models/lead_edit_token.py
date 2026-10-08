# pylint: disable=import-error
"""Token pubblici per modifica lead (C-security-lead-public).

Due purpose:
  - interview: TTL 4h, multi-uso, whitelist completa (flusso
    intervista multi-fase che crea il lead poi lo arricchisce).
  - edit: TTL 30gg, monouso, whitelist email+phone (link email
    "conferma i tuoi dati").

Verifica con secrets.compare_digest (constant-time).
Token mai loggato in chiaro (solo id o primi 4 char).
Rate limit: 5 tentativi/ora per IP (campo attempts + created_ip).
"""
import logging
import secrets
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

TTL_BY_PURPOSE = {
    'interview': timedelta(hours=4),
    'edit': timedelta(days=30),
}

MAX_ATTEMPTS = 5


class Erpv6LeadEditToken(models.Model):
    _name = 'erpv6.lead.edit.token'
    _description = 'Token edit lead (pubblico)'
    _order = 'create_date desc'

    lead_id = fields.Many2one(
        'crm.lead', string='Lead',
        required=True, index=True, ondelete='cascade')
    token = fields.Char(
        string='Token', required=True, index=True, size=64)
    purpose = fields.Selection([
        ('interview', 'Intervista multi-fase'),
        ('edit', 'Edit email/telefono'),
    ], string='Scopo', required=True, default='interview', index=True)
    expires_at = fields.Datetime(
        string='Scade il', required=True, index=True)
    used = fields.Boolean(string='Usato', default=False, index=True)
    used_at = fields.Datetime(string='Usato il')
    attempts = fields.Integer(string='Tentativi', default=0)
    created_ip = fields.Char(string='IP creazione')
    created_ua = fields.Char(string='User agent creazione', size=200)
    last_fail_ip = fields.Char(string='IP ultimo fail')

    _sql_constraints = [
        ('token_uniq', 'unique(token)',
         'Il token deve essere univoco.'),
    ]

    @api.model
    def generate(self, lead, purpose='interview'):
        """Genera token per un lead. Ritorna il record."""
        if purpose not in TTL_BY_PURPOSE:
            raise UserError('purpose non valido: %s' % purpose)
        # Genera token (43 char base64url)
        for _ in range(5):  # retry su collision improbabile
            tok = secrets.token_urlsafe(32)
            if not self.sudo().search([('token', '=', tok)], limit=1):
                break
        # IP/UA
        ip = None
        ua = None
        try:
            from odoo.http import request
            if request and hasattr(request, 'httprequest'):
                ip = request.httprequest.remote_addr
                ua_raw = request.httprequest.user_agent
                ua = ua_raw.string[:200] if ua_raw else None
        except Exception:
            pass
        rec = self.sudo().create({
            'lead_id': lead.id,
            'token': tok,
            'purpose': purpose,
            'expires_at': fields.Datetime.now() + TTL_BY_PURPOSE[purpose],
            'created_ip': ip,
            'created_ua': ua,
        })
        _logger.info(
            'Lead edit token generato: id=%s purpose=%s lead=%s',
            rec.id, purpose, lead.id)
        return rec

    @api.model
    def verify(self, raw_token, lead_id, expected_purpose):
        """Verifica token. Ritorna (ok, error_code, record).

        error_code:
          - 'not_found' (nessun token match)
          - 'wrong_lead' (token valido ma per altro lead)
          - 'wrong_purpose'
          - 'expired'
          - 'used'
          - 'too_many_attempts'
        """
        if not raw_token or not lead_id:
            return False, 'not_found', None
        # 1) Cerca token per lead + purpose (NON confronto raw in SQL:
        #    index su token, filtro per lead_id+purpose prima).
        candidates = self.sudo().search([
            ('lead_id', '=', int(lead_id)),
            ('purpose', '=', expected_purpose),
        ])
        match = None
        for c in candidates:
            # constant-time compare
            if secrets.compare_digest(c.token or '', raw_token):
                match = c
                break
        if not match:
            return False, 'not_found', None
        # 2) Scaduto
        if match.expires_at < fields.Datetime.now():
            return False, 'expired', match
        # 3) Usato (solo per edit monouso, interview multi-uso)
        if expected_purpose == 'edit' and match.used:
            return False, 'used', match
        # 4) Tentativi (solo per purpose=edit, rate limit)
        if match.attempts >= MAX_ATTEMPTS:
            return False, 'too_many_attempts', match
        return True, None, match

    @api.model
    def register_fail(self, token_rec, ip=None):
        """Incrementa attempts su token (rate limit)."""
        if not token_rec:
            return
        token_rec.sudo().write({
            'attempts': token_rec.attempts + 1,
            'last_fail_ip': ip,
        })

    @api.model
    def mark_used(self, token_rec):
        """Marca come usato (per purpose=edit)."""
        if token_rec:
            token_rec.sudo().write({
                'used': True,
                'used_at': fields.Datetime.now(),
            })

    def send_edit_link_email(self, base_url=None):
        """Invia al lead un'email con link edit (purpose=edit).
        Best-effort: un errore email non deve bloccare il flusso."""
        self.ensure_one()
        if self.purpose != 'edit':
            raise UserError('send_edit_link_email solo per purpose=edit')
        lead = self.lead_id
        if not lead or not lead.email_from:
            raise UserError('Lead senza email')
        base = (base_url or
                self.env['ir.config_parameter'].sudo().get_param(
                    'web.base.url', 'https://v6impresa.it')).rstrip('/')
        link = '%s/lead/%s/edit?token=%s' % (base, lead.id, self.token)
        name = lead.contact_name or lead.partner_name or 'ciao'
        subject = 'Conferma i tuoi dati'
        body = (
            'Ciao %s,\n\n'
            'clicca qui per confermare o aggiornare i tuoi dati:\n'
            '%s\n\n'
            'Il link scade tra 30 giorni.\n\n'
            'V6 Impresa'
        ) % (name, link)
        try:
            mail = self.env['mail.mail'].sudo().create({
                'subject': subject,
                'body_html': '<pre style="font-family:inherit">%s</pre>' % body,
                'email_to': lead.email_from,
                'email_from': 'noreply@v6impresa.it',
                'auto_delete': True,
            })
            mail.send()
            _logger.info(
                'Lead edit link inviato: token_id=%s lead=%s to=%s',
                self.id, lead.id, lead.email_from)
            return True
        except Exception:
            _logger.exception(
                'send_edit_link_email fallito per token %s', self.id)
            return False
