# pylint: disable=import-error
"""Estensione erpv6.agent.proposal (C5-P3).

03/10/2026: accept di una proposta → crea anche un erpv6.todo
(visibile in /admin/todo Next.js), in aggiunta all'activity
nativa Odoo già creata da _do_accept.

L'estensione vive QUI (erpv6_signals) e non in erpv6_agent perché
erpv6_agent non può dipendere da erpv6_todo (ciclo:
erpv6_todo → erpv6_winwin_renderdata → erpv6_agent → erpv6_todo).
"""
import logging

from odoo import fields, models

_logger = logging.getLogger(__name__)


class AgentProposal(models.Model):
    _inherit = 'erpv6.agent.proposal'

    todo_id = fields.Many2one(
        'erpv6.todo', string='TODO collegato',
        readonly=True, ondelete='set null',
        help='TODO creato automaticamente quando la proposta è accettata. '
             'Coesiste con mail.activity (activity_schedule) per '
             'compatibilità con la vista Odoo.')

    def _do_accept(self, assignee):
        """Override: dopo l'accept nativo (activity + notifica), crea
        anche un erpv6.todo visibile in /admin/todo."""
        # Chiama l'implementazione base (activity_schedule + notify)
        result = super()._do_accept(assignee)

        # Poi crea il TODO (idempotente via source=kaizen:<id>)
        for proposal in self:
            source_key = f'kaizen:{proposal.id}'
            Todo = self.env['erpv6.todo'].sudo()
            existing = Todo.search([('source', '=', source_key)], limit=1)
            if existing:
                proposal.todo_id = existing.id
                continue
            try:
                todo = Todo.create({
                    'name': (proposal.name or '')[:120],
                    'description': proposal.proposal_text or '',
                    'user_id': assignee.id,
                    'due_date': fields.Date.add(
                        fields.Date.context_today(proposal), days=3),
                    'state': 'open',
                    'is_auto': True,
                    'source': source_key,
                })
                proposal.todo_id = todo.id
            except Exception:  # pylint: disable=broad-except
                _logger.exception(
                    "Creazione erpv6.todo per proposta %s fallita (non bloccante)",
                    proposal.id)
        return result
