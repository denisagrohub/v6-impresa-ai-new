# pylint: disable=import-error
"""TODO operativi V6 Impresa.

01/10/2026 (Fase C - C1a-1): ogni utente ha la sua lista TODO.
Record rule: vede solo i propri. Admin bypassa la rule (group_system).
Placeholder is_auto/source per C1b (TODO generati automaticamente da
motori/KB).
"""
import logging
from datetime import timedelta

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6Todo(models.Model):
    _name = 'erpv6.todo'
    _description = 'TODO V6 Impresa'
    _order = 'state, due_date asc, create_date desc'

    name = fields.Char(string='Descrizione', required=True)
    description = fields.Text(string='Note')

    user_id = fields.Many2one(
        'res.users', string='Assegnato a',
        required=True,
        default=lambda self: self.env.user,
        index=True,
    )

    project_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto Partner',
        ondelete='set null', index=True,
    )
    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal',
        ondelete='set null', index=True,
    )

    due_date = fields.Date(string='Scadenza', index=True)

    # 07/10/2026 (C-todo-1): orario specifico del TODO.
    # Se compilato, genera/aggiorna un calendar.event collegato
    # (sync bidirezionale in models/todo.py e calendar_event_ext.py).
    # Due_date resta la data di scadenza (business); scheduled_at
    # e' il blocco in calendario (data+ora+durata).
    scheduled_at = fields.Datetime(
        string='Orario',
        help='Opzionale. Se compilato, crea/aggiorna un '
             'calendar.event collegato. Modifiche all\'evento '
             'in Odoo aggiornano questo campo.',
        index=True,
    )
    duration_minutes = fields.Integer(
        string='Durata (min)',
        default=30,
        help='Durata del blocco in calendario. Default 30.',
    )
    calendar_event_id = fields.Many2one(
        'calendar.event',
        string='Evento calendario',
        readonly=True, ondelete='set null',
        help='Evento calendar generato da questo TODO.',
    )

    state = fields.Selection(
        selection=[
            ('open', 'Aperto'),
            ('done', 'Fatto'),
            ('cancelled', 'Annullato'),
        ],
        string='Stato', default='open', required=True, index=True,
    )

    done_at = fields.Datetime(string='Completato il', readonly=True)

    # Prep per C1b (TODO automatici)
    is_auto = fields.Boolean(
        string='Generato automaticamente', default=False, readonly=True,
    )
    source = fields.Char(
        string='Origine', readonly=True,
        help='Vuoto per TODO manuali. In C1b: nome del motore/KB.',
    )

    active = fields.Boolean(default=True)

    @api.model_create_multi
    def create(self, vals_list):
        todos = super().create(vals_list)
        # 07/10/2026 (C-todo-1): sync calendar dopo create
        for t in todos:
            if t.scheduled_at and not self.env.context.get('skip_todo_sync'):
                try:
                    t._sync_calendar_event()
                except Exception:
                    _logger.exception(
                        'Erpv6Todo create: sync calendar fallito per id=%s', t.id)
        return todos

    def write(self, vals):
        if vals.get('state') == 'done':
            vals['done_at'] = fields.Datetime.now()
        elif vals.get('state') in ('open', 'cancelled'):
            vals['done_at'] = False
        res = super().write(vals)
        # 07/10/2026 (C-todo-1): sync solo se cambiano campi rilevanti
        if self.env.context.get('skip_todo_sync'):
            return res
        relevant = {'scheduled_at', 'duration_minutes', 'name',
                    'due_date', 'state', 'user_id'}
        if relevant.intersection(vals.keys()):
            for t in self:
                try:
                    t._sync_calendar_event()
                except Exception:
                    _logger.exception(
                        'Erpv6Todo write: sync calendar fallito per id=%s', t.id)
        return res

    def unlink(self):
        # 07/10/2026 (C-todo-1): cancella evento collegato
        for t in self:
            if t.calendar_event_id:
                try:
                    t.calendar_event_id.sudo().with_context(
                        skip_todo_sync=True).unlink()
                except Exception:
                    _logger.warning(
                        'Erpv6Todo unlink: impossibile cancellare evento %s',
                        t.calendar_event_id.id)
        return super().unlink()

    def _sync_calendar_event(self):
        """Crea/aggiorna/cancella calendar.event da scheduled_at."""
        self.ensure_one()
        Event = self.env['calendar.event'].sudo()
        if not self.scheduled_at:
            # Niente orario: cancella evento se esiste
            if self.calendar_event_id:
                self.calendar_event_id.with_context(
                    skip_todo_sync=True).unlink()
                self.with_context(skip_todo_sync=True).write({
                    'calendar_event_id': False,
                })
            return
        start = self.scheduled_at
        durata = self.duration_minutes or 30
        stop = start + timedelta(minutes=durata)
        # Marca done in descrizione se TODO chiuso
        done_marker = ''
        if self.state == 'done':
            done_marker = ' [FATTO]'
        descr_parts = ['TODO #%s%s' % (self.id, done_marker)]
        if self.project_id:
            descr_parts.append(self.project_id.name or '')
        descr = '\n'.join(p for p in descr_parts if p)
        vals = {
            'name': '%s%s' % (self.name, done_marker),
            'start': start,
            'stop': stop,
            'user_id': (self.user_id.id or self.env.user.id),
            'description': descr,
            'todo_id': self.id,
            'is_from_todo': True,
        }
        if self.calendar_event_id:
            self.calendar_event_id.with_context(
                skip_todo_sync=True).write(vals)
        else:
            event = Event.create(vals)
            self.with_context(skip_todo_sync=True).write({
                'calendar_event_id': event.id,
            })

    def action_done(self):
        self.write({'state': 'done'})

    def action_reopen(self):
        self.write({'state': 'open'})
