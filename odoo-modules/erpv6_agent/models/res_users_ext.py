# pylint: disable=import-error
"""Estende res.users con telegram_chat_id (C1b-bot-1).

02/10/2026: multi-utente per notifiche Telegram. Il campo chat_id
sulla config del bot rimane (backward compat: oggi solo Denis), ma
ogni utente può registrare il proprio chat_id via /start.
"""
from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    telegram_chat_id = fields.Char(
        string='Telegram chat ID',
        help='Chat privata col bot V6. Impostato via /start.',
        index=True,
        copy=False,
    )
    telegram_registered_at = fields.Datetime(
        string='Registrato su Telegram il',
        readonly=True,
    )
