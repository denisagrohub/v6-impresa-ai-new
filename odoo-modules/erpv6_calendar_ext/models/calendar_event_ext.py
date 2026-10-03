# pylint: disable=import-error
"""Estende calendar.event con contesto business V6.

03/10/2026 (C1b-agenda-1a): calendario nativo Odoo esteso con
relation_id, deal_id, booking_token_id, telegram_reminder_sent_at,
external_attendees.
"""
from odoo import fields, models


class CalendarEvent(models.Model):
    _inherit = 'calendar.event'

    relation_id = fields.Many2one(
        'erpv6.tracking.relation',
        string='Progetto Partner',
        index=True, ondelete='set null',
    )
    deal_id = fields.Many2one(
        'erpv6.deal',
        string='Deal',
        index=True, ondelete='set null',
    )
    booking_token_id = fields.Many2one(
        'erpv6.booking.token',
        string='Booking originario',
        index=True, ondelete='set null', readonly=True,
    )
    telegram_reminder_sent_at = fields.Datetime(
        string='Reminder Telegram inviato il',
        readonly=True,
    )
    external_attendees = fields.Text(
        string='Partecipanti esterni (email)',
        help='Email separate da virgola. Riceveranno il .ics solo se '
             'scaricato manualmente.',
    )
    # 03/10/2026 (C1b-agenda-1a): marker eventi gestiti dall'API V6.
    # Distingue dagli eventi nativi Odoo creati manualmente in /odoo/calendar.
    # La lista API e i PATCH/DELETE lavorano SOLO su is_v6_managed=True.
    is_v6_managed = fields.Boolean(
        string='Gestito da V6',
        default=False,
        readonly=True,
        index=True,
        help='True se creato via API V6. False per eventi nativi Odoo.',
    )
