# pylint: disable=import-error
"""R2-enforcement: hook su ir.mail_server.send_email.

03/10/2026 (C1b-agenda-COMPLETE-A): R2 era una regola morale, non
tecnica. Questo hook rende R2 un guardrail:

- mail.test_mode = True (default): ogni email outbound passa per la
  whitelist mail.test_whitelist. Destinatari fuori whitelist → invio
  bloccato + log warning.
- mail.test_whitelist: lista email separate da virgola, case-insensitive.
- Context `mail_transactional_approved=True`: bypassa la whitelist.
  Usato da flussi business espliciti (es. invito .ics a un cliente
  confermato dall'utente con dialogo UI).

Il log warning è permanente (non silenzioso): aiuta il debug e
l'audit. Il return False silenzioso permette ai chiamanti di
proseguire senza crash (il codice chiamante può verificare il
risultato).
"""
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)


class IrMailServer(models.Model):
    _inherit = 'ir.mail_server'

    @api.model
    def send_email(self, message, *args, **kwargs):
        ICP = self.env['ir.config_parameter'].sudo()
        test_mode = (ICP.get_param('mail.test_mode', 'True') or 'True') == 'True'
        if not test_mode:
            return super().send_email(message, *args, **kwargs)

        # Eccezione esplicita per invii transazionali approvati.
        if self.env.context.get('mail_transactional_approved'):
            _logger.info(
                "MAIL transactional approved → To=%s Cc=%s (bypass whitelist)",
                message.get('To'), message.get('Cc'),
            )
            return super().send_email(message, *args, **kwargs)

        whitelist_raw = ICP.get_param('mail.test_whitelist', '') or ''
        whitelist = {
            e.strip().lower() for e in whitelist_raw.split(',') if e.strip()
        }

        # Estrai indirizzi effettivi da To + Cc
        to_emails = _parse_addrs(message.get('To') or '')
        cc_emails = _parse_addrs(message.get('Cc') or '')
        all_recipients = to_emails + cc_emails

        blocked = [e for e in all_recipients if e not in whitelist]
        if blocked:
            _logger.warning(
                "MAIL BLOCKED (test_mode) → To=%s Cc=%s | fuori whitelist: %s | "
                "Per sbloccare: aggiungi a mail.test_whitelist o usa context "
                "mail_transactional_approved=True.",
                message.get('To'), message.get('Cc'), blocked,
            )
            return False

        return super().send_email(message, *args, **kwargs)


def _parse_addrs(raw):
    """Estrae email da header To/Cc (può contenere 'Nome <a@b.com>' o
    lista separata da virgola). Ritorna lista lowercase."""
    from email.utils import getaddresses
    if not raw:
        return []
    out = []
    for _, addr in getaddresses([raw]):
        if addr:
            out.append(addr.strip().lower())
    return out
