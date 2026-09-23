"""Helper per inviare email di sistema con mittente e server corretti.

23/09/2026: message_notify() decide in-app vs email in base alle
preferenze del partner e non permette di forzare il mail_server.
Qui creiamo direttamente un mail.mail con:
- mittente V6impresa Sistema <sistema@v6sviluppoimpresa.it>
- mail server Register v6sviluppo (from_filter=v6sviluppoimpresa.it)
- auto_delete False (mantiene storico)
Questo GARANTISCE email (non in-app) e mittente allineato.
"""
import logging

from odoo import fields, models

_logger = logging.getLogger(__name__)


def send_system_mail(env, to_email, subject, body_html, model=None, res_id=None):
    """Invia email sistema. Ritorna mail.mail o None se errore.

    Non solleva eccezioni: log e ritorno None se qualcosa fallisce,
    cosi' la logica chiamante (write, action, ecc.) non si blocca.
    """
    if not to_email:
        _logger.warning('send_system_mail: to_email vuoto, skip')
        return None
    try:
        server = env['ir.mail_server'].sudo().search(
            [('from_filter', '=', 'v6sviluppoimpresa.it'), ('active', '=', True)],
            limit=1,
        )
        from_addr = 'V6impresa Sistema <sistema@v6sviluppoimpresa.it>'
        mail = env['mail.mail'].sudo().create({
            'email_from': from_addr,
            'email_to': to_email,
            'subject': subject,
            'body_html': body_html,
            'mail_server_id': server.id if server else False,
            'auto_delete': False,
        })
        mail.send()
        _logger.info('send_system_mail OK -> %s (subject: %s)', to_email, subject[:60])
        return mail
    except Exception:
        _logger.exception('send_system_mail fallito per %s', to_email)
        return None


def get_admin_email(env):
    """Email admin per notifiche di sistema. Priorita':
    1. ir.config_parameter erpv6.notify.admin_email
    2. base.user_admin.partner_id.email
    """
    p = env['ir.config_parameter'].sudo().get_param('erpv6.notify.admin_email')
    if p:
        return p
    admin = env.ref('base.user_admin', raise_if_not_found=False)
    if admin and admin.partner_id.email:
        return admin.partner_id.email
    return None

def create_magic_link(env, partner, purpose='generic', redirect_to=None, hours=24):
    """Crea un magic link per il partner. Ritorna URL o None."""
    try:
        link = env['erpv6.consultant.magic.link'].sudo().create_for_partner(
            partner, purpose=purpose, redirect_to=redirect_to, hours=hours,
        )
        return link.get_url()
    except Exception:
        _logger.exception('create_magic_link fallito per partner %s', partner.id)
        return None
