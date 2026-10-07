# pylint: disable=import-error
"""R2-enforcement: hook su ir.mail_server.send_email.

03/10/2026 (C1b-agenda-COMPLETE-A): R2 era una regola morale, non
tecnica. Questo hook rende R2 un guardrail.

04/10/2026 (C5-mail-whitelist-dinamica): whitelist a 5 livelli.

- mail.test_mode = True (default): ogni email outbound passa per la
  whitelist. Destinatari fuori whitelist -> invio bloccato + log warning.
- mail.test_whitelist: lista email separate da virgola, case-insensitive.
- mail.whitelist_domains: domini aziendali (default v6impresa.it, agrohubitalia.it).
- Context `mail_transactional_approved=True`: bypassa la whitelist.

5 livelli (OR logico):
  1. Manuale (mail.test_whitelist)
  2. Dominio aziendale (mail.whitelist_domains)
  3. email_slug@v6impresa.it per utenti V6 attivi con gruppo
  4. Login (email personale) per utenti V6 attivi con gruppo
  5. partner.email di interni V6 (con user attivo in gruppo)
"""
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)

# 04/10/2026: gruppi che identificano "utente V6 interno" per la
# whitelist dinamica (livelli 3/4/5). Se un utente ha almeno uno di
# questi gruppi, è considerato interno.
_V6_GROUP_XMLIDS = (
    'erpv6_core.group_consulente',
    'erpv6_core.group_chief_projects',
    'erpv6_core.group_chief_bandi',
    'erpv6_core.group_chief_accounting',
    'erpv6_core.group_chief_marketing',
    'erpv6_core.group_chief_kb',
    'base.group_system',
)


class IrMailServer(models.Model):
    _inherit = 'ir.mail_server'

    @api.model
    def send_email(self, message, *args, **kwargs):
        ICP = self.env['ir.config_parameter'].sudo()
        test_mode = (ICP.get_param('mail.test_mode', 'True') or 'True') == 'True'
        if not test_mode:
            return super().send_email(message, *args, **kwargs)

        if self.env.context.get('mail_transactional_approved'):
            # 07/10/2026 (C-email-fix-b): log esplicito per audit.
            # Il context e' settato SOLO dagli endpoint manuali
            # (composer/forward/reply), mai dai cron/agenti.
            _logger.info(
                "MAIL manual bypass -> To=%s Cc=%s (composer invio manuale)",
                message.get('To'), message.get('Cc'),
            )
            return super().send_email(message, *args, **kwargs)

        # Estrai indirizzi effettivi da To + Cc
        to_emails = _parse_addrs(message.get('To') or '')
        cc_emails = _parse_addrs(message.get('Cc') or '')
        all_recipients = to_emails + cc_emails

        blocked = [e for e in all_recipients if not self._is_whitelisted(e)]
        if blocked:
            _logger.warning(
                "MAIL BLOCKED (test_mode) -> To=%s Cc=%s | fuori whitelist: %s | "
                "Per sbloccare: aggiungi a mail.test_whitelist o usa context "
                "mail_transactional_approved=True.",
                message.get('To'), message.get('Cc'), blocked,
            )
            return False

        return super().send_email(message, *args, **kwargs)

    @api.model
    def _is_whitelisted(self, email):
        """04/10/2026 (C5-mail-whitelist-dinamica): 5 livelli (OR).

        Ritorna True se l'indirizzo è autorizzato in test_mode.
        """
        e = (email or '').strip().lower()
        if not e or '@' not in e:
            return False

        ICP = self.env['ir.config_parameter'].sudo()

        # Livello 1: whitelist manuale (config param)
        manual_raw = ICP.get_param('mail.test_whitelist', '') or ''
        manual = {x.strip().lower() for x in manual_raw.split(',') if x.strip()}
        if e in manual:
            return True

        # Livello 2: dominio aziendale (config param)
        domains_raw = ICP.get_param(
            'mail.whitelist_domains',
            'v6impresa.it,agrohubitalia.it') or ''
        domains = [d.strip().lower() for d in domains_raw.split(',') if d.strip()]
        for d in domains:
            if e.endswith('@' + d):
                return True

        # Risolvi i gruppi V6 (per livelli 3/4/5)
        group_ids = []
        for xid in _V6_GROUP_XMLIDS:
            g = self.env.ref(xid, raise_if_not_found=False)
            if g:
                group_ids.append(g.id)
        if not group_ids:
            return False

        U = self.env['res.users'].sudo()

        # Livello 3: email_slug@<dominio aziendale> per utenti V6 attivi
        for d in domains:
            suffix = '@' + d
            if e.endswith(suffix):
                slug = e[:-len(suffix)]
                u = U.search([
                    ('email_slug', '=', slug),
                    ('active', '=', True),
                    ('groups_id', 'in', group_ids),
                ], limit=1)
                if u:
                    return True

        # Livello 4: login (email personale) di utenti V6 attivi
        u = U.search([
            ('login', '=ilike', e),
            ('active', '=', True),
            ('groups_id', 'in', group_ids),
        ], limit=1)
        if u:
            return True

        # Livello 5: partner.email di interni V6 (con user attivo nei gruppi)
        P = self.env['res.partner'].sudo()
        p = P.search([('email', '=ilike', e)], limit=1)
        if p and p.user_ids:
            for u in p.user_ids:
                if u.active and set(u.groups_id.ids) & set(group_ids):
                    return True

        return False

    @api.model
    def _get_internal_user_emails(self):
        """Ritorna set lowercase di tutte le email di utenti V6 interni
        (share=False, active=True): user.email + user.login + partner.email.
        DEPRECATO: usato solo per retrocompat; _is_whitelisted fa i check
        granulari."""
        users = self.env['res.users'].sudo().search([
            ('share', '=', False),
            ('active', '=', True),
        ])
        emails = set()
        for u in users:
            for src in (u.email, u.login, u.partner_id.email):
                if src and '@' in src:
                    emails.add(src.strip().lower())
        return emails


def _parse_addrs(raw):
    """Estrae email da header To/Cc (puo' contenere 'Nome <a@b.com>' o
    lista separata da virgola). Ritorna lista lowercase."""
    from email.utils import getaddresses
    if not raw:
        return []
    out = []
    for _, addr in getaddresses([raw]):
        if addr:
            out.append(addr.strip().lower())
    return out
