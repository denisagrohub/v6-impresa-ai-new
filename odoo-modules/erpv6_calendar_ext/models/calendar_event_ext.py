# pylint: disable=import-error
"""Estende calendar.event con contesto business V6.

03/10/2026 (C1b-agenda-1a): calendario nativo Odoo esteso con
relation_id, deal_id, booking_token_id, telegram_reminder_sent_at,
external_attendees.
"""
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


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
    # 03/10/2026 (D.5): tracciamento invio invito a external_attendees
    external_invite_sent_at = fields.Datetime(
        string='Invito esterno inviato il',
        readonly=True,
        help='Popolato quando il controller invia email transazionale '
             'ai partecipanti esterni (con .ics allegato).',
    )


    # 07/10/2026 (C-todo-1): link a erpv6.todo.
    # Un calendar.event con is_from_todo=True nasce da un TODO
    # (scheduled_at compilato). Modifiche a start/stop dell'evento
    # aggiornano todo.scheduled_at (sync bidirezionale, context
    # skip_todo_sync previene loop).
    todo_id = fields.Many2one(
        'erpv6.todo',
        string='TODO origine',
        ondelete='set null', index=True,
    )
    is_from_todo = fields.Boolean(
        string='Da TODO',
        default=False, index=True,
        help='True se generato automaticamente da un erpv6.todo.',
    )

    # 07/10/2026 (C-todo-1-fix): se l'evento e' da TODO ed e' stato
    # cancellato dall'utente (non dal TODO stesso, che passa
    # skip_todo_sync), resetta scheduled_at del TODO collegato.
    # Senza questo, scheduled_at resta compilato e al prossimo write
    # del TODO l'evento viene ricreato.
    def unlink(self):
        if not self.env.context.get('skip_todo_sync'):
            for e in self.filtered(lambda x: x.is_from_todo and x.todo_id):
                try:
                    e.todo_id.sudo().with_context(
                        skip_todo_sync=True).write({
                            'scheduled_at': False,
                            'calendar_event_id': False,
                        })
                except Exception:
                    _logger.exception(
                        'calendar.event unlink: reset TODO %s fallito',
                        e.todo_id.id)
        return super().unlink()

    # 07/10/2026 (C-todo-1): sync inversa. Se l'evento e' da TODO
    # e cambia start/stop/name, aggiorna il TODO collegato.
    # context skip_todo_sync previene loop (il TODO scrive l'evento
    # con skip_todo_sync=True, cosi' non ritorna al TODO).
    def write(self, vals):
        res = super().write(vals)
        if self.env.context.get('skip_todo_sync'):
            return res
        if not any(k in vals for k in ('start', 'stop', 'name')):
            return res
        for e in self.filtered(lambda x: x.is_from_todo and x.todo_id):
            try:
                todo_vals = {}
                if 'start' in vals and e.start:
                    todo_vals['scheduled_at'] = e.start
                if 'stop' in vals and e.start and e.stop:
                    delta = e.stop - e.start
                    todo_vals['duration_minutes'] = int(delta.total_seconds() / 60)
                if 'name' in vals and e.name:
                    # Rimuovi marker [FATTO] se presente
                    nm = (e.name or '').replace(' [FATTO]', '').strip()
                    if nm:
                        todo_vals['name'] = nm
                if todo_vals:
                    e.todo_id.sudo().with_context(
                        skip_todo_sync=True).write(todo_vals)
            except Exception:
                _logger.exception(
                    'calendar.event write: sync inversa TODO fallita per e=%s', e.id)
        return res

    # ═══════════════════════════════════════════════════════════════
    # 03/10/2026 (C1b-agenda-COMPLETE-B): notifica immediata al create
    # ═══════════════════════════════════════════════════════════════
    def _notify_attendees(self):
        """Notifica immediata a tutti i partner V6 dopo il create.

        - Utente V6 con telegram_chat_id → messaggio Telegram con
          bottoni Accetto/Rifiuto.
        - Utente V6 senza Telegram → email interna V6 (whitelisted).
        - Partner esterni NON ricevono nulla da qui: l'invito esterno
          è gestito da D.4 con conferma esplicita utente.
        """
        self.ensure_one()
        for partner in self.partner_ids:
            users = partner.user_ids.filtered(lambda u: u.active)
            for user in users:
                try:
                    if user.telegram_chat_id:
                        self._notify_via_telegram(user)
                    else:
                        self._notify_via_email_internal(user)
                except Exception:  # pylint: disable=broad-except
                    _logger.exception(
                        "Notify attendee fallita per user %s (event %s)",
                        user.id, self.id)

    def _notify_via_telegram(self, user):
        """Invia messaggio Telegram con bottoni RSVP inline."""
        config = self.env['erpv6.agent.telegram.config'].sudo().search(
            [('is_active', '=', True)], limit=1)
        if not config:
            _logger.warning("_notify_via_telegram: nessuna config attiva")
            return
        attendee = self.attendee_ids.filtered(
            lambda a: a.partner_id.id == user.partner_id.id)[:1]
        if not attendee:
            _logger.warning(
                "_notify_via_telegram: attendee mancante per user %s", user.id)
            return
        start_local = fields.Datetime.context_timestamp(user, self.start)
        end_local = fields.Datetime.context_timestamp(user, self.stop)
        text = (
            f"📅 Nuovo appuntamento\n"
            f"{self.name}\n"
            f"🕐 {start_local.strftime('%d/%m %H:%M')} – "
            f"{end_local.strftime('%H:%M')}"
        )
        if self.location:
            text += f"\n📍 {self.location}"
        if self.relation_id:
            text += f"\n📁 {self.relation_id.name}"
        markup = {'inline_keyboard': [[
            {'text': '✅ Accetto',
             'callback_data': f'cal accept {attendee.id}'},
            {'text': '❌ Rifiuto',
             'callback_data': f'cal decline {attendee.id}'},
        ]]}
        ok = config.send_message(
            text=text,
            reply_markup=markup,
            chat_id_override=user.telegram_chat_id,
        )
        if not ok:
            _logger.warning(
                "_notify_via_telegram: send_message False per user %s", user.id)

    # ═══════════════════════════════════════════════════════════════
    # 03/10/2026 (D.3): reminder Telegram 2h prima dell'evento
    # ═══════════════════════════════════════════════════════════════
    @api.model
    def _cron_telegram_reminder(self):
        """Cron ogni 15 min. Invia reminder agli attendee con
        state='accepted' se l'evento inizia tra 1h55 e 2h05.

        Solo accepted: chi non ha risposto non ha confermato.
        Telegram se telegram_chat_id, altrimenti email interna V6.
        """
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        win_start = now + timedelta(hours=1, minutes=55)
        win_end = now + timedelta(hours=2, minutes=5)

        events = self.search([
            ('start', '>=', win_start),
            ('start', '<=', win_end),
            ('is_v6_managed', '=', True),
            ('telegram_reminder_sent_at', '=', False),
        ])
        if not events:
            return 0
        sent_count = 0
        for event in events:
            attendee_accepted = event.attendee_ids.filtered(
                lambda a: a.state == 'accepted')
            for attendee in attendee_accepted:
                for user in attendee.partner_id.user_ids.filtered(
                        lambda u: u.active):
                    try:
                        event._send_reminder(user, attendee)
                        sent_count += 1
                    except Exception:  # pylint: disable=broad-except
                        _logger.exception(
                            "Reminder fail user=%s event=%s",
                            user.id, event.id)
            event.write({
                'telegram_reminder_sent_at': fields.Datetime.now(),
            })
        return sent_count

    def _send_reminder(self, user, attendee):
        """Invia reminder: Telegram se possibile, altrimenti email."""
        start_local = fields.Datetime.context_timestamp(user, self.start)
        text = (
            f"⏰ Promemoria: appuntamento tra 2 ore\n"
            f"{self.name}\n"
            f"🕐 {start_local.strftime('%d/%m %H:%M')}"
        )
        if self.location:
            text += f"\n📍 {self.location}"

        if user.telegram_chat_id:
            config = self.env['erpv6.agent.telegram.config'].sudo().search(
                [('is_active', '=', True)], limit=1)
            if config:
                config.send_message(
                    text=text,
                    chat_id_override=user.telegram_chat_id,
                )
                return

        # Fallback: email interna V6
        template = self.env.ref(
            'erpv6_calendar_ext.mail_template_internal_invite',
            raise_if_not_found=False)
        if template:
            template.with_context(
                accept_url='', decline_url='',
            ).send_mail(
                self.id, force_send=False,
                email_values={'email_to': user.login},
            )

    def _notify_via_email_internal(self, user):
        """Email interna V6 (in whitelist, non serve transactional)."""
        attendee = self.attendee_ids.filtered(
            lambda a: a.partner_id.id == user.partner_id.id)[:1]
        if not attendee:
            return
        template = self.env.ref(
            'erpv6_calendar_ext.mail_template_internal_invite',
            raise_if_not_found=False)
        if not template:
            _logger.warning("Template email interno mancante")
            return
        base_url = self.env['ir.config_parameter'].sudo().get_param(
            'web.base.url', 'https://erpv6.it')
        accept_url = (
            f"{base_url}/api/v1/appointments/rsvp/{attendee.id}/"
            f"{attendee.access_token}/accept"
        )
        decline_url = (
            f"{base_url}/api/v1/appointments/rsvp/{attendee.id}/"
            f"{attendee.access_token}/decline"
        )
        try:
            template.with_context(
                accept_url=accept_url,
                decline_url=decline_url,
            ).send_mail(
                self.id,
                force_send=False,
                email_values={'email_to': user.login},
            )
        except Exception:  # pylint: disable=broad-except
            _logger.exception(
                "_notify_via_email_internal fallita per user %s", user.id)
