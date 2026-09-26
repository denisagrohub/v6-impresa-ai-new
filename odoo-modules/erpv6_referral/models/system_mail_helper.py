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


def _resolve_recipients(env, to_email):
    """27/09/2026: rispetta la preferenza x_v6_email_mode del partner.

    Ritorna (email_to, email_cc) tupla.
    - 'personal' (default): email_to = to_email, cc vuoto
    - 'v6': sostituisce con slug@v6impresa.it
    - 'both': to_email personale + slug@v6impresa.it in cc
    """
    if not to_email:
        return (to_email, '')
    Partner = env['res.partner'].sudo()
    if 'x_v6_email_mode' not in Partner._fields:
        return (to_email, '')
    partner = Partner.search([('email', '=', to_email)], limit=1)
    if not partner:
        return (to_email, '')

    mode = partner.x_v6_email_mode or 'personal'
    if mode == 'personal':
        return (to_email, '')

    # Determina slug: da user collegato o da company
    slug = None
    user = env['res.users'].sudo().search([('partner_id', '=', partner.id)], limit=1)
    if user and getattr(user, 'email_slug', None):
        slug = user.email_slug

    if not slug:
        # fallback: prova a ricavare dall'email (prima parte)
        return (to_email, '')

    alias_email = f'{slug}@v6impresa.it'

    if mode == 'v6':
        return (alias_email, '')
    if mode == 'both':
        return (to_email, alias_email)
    return (to_email, '')


def send_system_mail(env, to_email, subject, body_html, model=None, res_id=None):
    """Invia email sistema. Ritorna mail.mail o None se errore.

    Rispetta la preferenza x_v6_email_mode del partner (personal/v6/both).
    """
    if not to_email:
        _logger.warning('send_system_mail: to_email vuoto, skip')
        return None
    try:
        email_to, email_cc = _resolve_recipients(env, to_email)
        server = env['ir.mail_server'].sudo().search(
            [('from_filter', '=', 'v6sviluppoimpresa.it'), ('active', '=', True)],
            limit=1,
        )
        from_addr = 'V6impresa Sistema <sistema@v6sviluppoimpresa.it>'
        vals = {
            'email_from': from_addr,
            'email_to': email_to,
            'subject': subject,
            'body_html': body_html,
            'mail_server_id': server.id if server else False,
            'auto_delete': False,
        }
        if email_cc:
            vals['email_cc'] = email_cc
        mail = env['mail.mail'].sudo().create(vals)
        mail.send()
        _logger.info(
            'send_system_mail OK -> to=%s cc=%s (subject: %s)',
            email_to, email_cc or '-', subject[:60],
        )
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
