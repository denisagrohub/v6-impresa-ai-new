# pylint: disable=import-error
"""Timeline eventi del deal — Storia strutturata.

30/09/2026 (F1 S1): ogni cosa che modifica o influenza un deal è un
evento della timeline: tavoli, call, email rilevanti, cambi numeri,
nuovi stakeholder. La fotografia corrente resta su erpv6.deal; qui
sta la STORIA (chi, quando, perché, cosa è cambiato).

Non sostituisce il chatter (mail.message) né i segnali Kaizen né le
comunicazioni Agent: sono livelli diversi.
- mail.message: log tecnico automatico (follower, mail in/out)
- kaizen.detected_signal: pattern detection automatica
- agent.communication: thread conversazionali con AI
- deal.event: storia business strutturata, con cambi espliciti
"""
import logging

from odoo import api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6DealEvent(models.Model):
    _name = 'erpv6.deal.event'
    _description = 'Evento timeline deal'
    _order = 'event_date desc, id desc'
    _rec_name = 'title'

    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal',
        required=True, ondelete='cascade', index=True)

    event_type = fields.Selection([
        ('tavolo_incontro', '🪑 Tavolo / Incontro'),
        ('call', '📞 Call'),
        ('email_rilevante', '📧 Email rilevante'),
        ('documento_ricevuto', '📄 Documento ricevuto'),
        ('cambio_numeri', '💰 Cambio numeri'),
        ('nuovo_stakeholder', '👤 Nuovo stakeholder'),
        ('cambio_stato', '🔄 Cambio stato deal'),
        ('nota_operativa', '📝 Nota operativa'),
        ('altro', '• Altro'),
    ], string='Tipo', required=True, default='nota_operativa', index=True)

    event_date = fields.Datetime(
        string='Data/ora evento', required=True, index=True,
        default=fields.Datetime.now)

    title = fields.Char(string='Titolo', required=True)

    description = fields.Text(string='Descrizione')

    attendees = fields.Many2many(
        'res.partner', 'erpv6_deal_event_attendee_rel',
        'event_id', 'partner_id',
        string='Partecipanti')

    # Riferimenti esterni
    source_attachment_id = fields.Many2one(
        'ir.attachment', string='Documento allegato')

    source_url = fields.Char(
        string='Link esterno',
        help='Es. link a verbale su Drive, registrazione call, ecc.')

    # Patch strutturata sui campi deal (json):
    #   {"prezzo_cessione": {"from": 84, "to": 86}}
    changes_applied = fields.Json(
        string='Modifiche applicate',
        help='Patch strutturata sui campi del deal, applicata automaticamente.')

    # Controllo visibilità
    visibility = fields.Selection([
        ('internal', 'Solo admin'),
        ('consultant', 'Visibile al consulente'),
        ('all', 'Visibile a tutti i participant'),
    ], string='Visibilità', default='consultant', required=True)

    created_by_id = fields.Many2one(
        'res.users', string='Creato da',
        default=lambda self: self.env.user, readonly=True)

    # Computed per UI
    is_auto = fields.Boolean(
        string='Automatico',
        help='True se generato da regola di sistema, False se manuale.')

    def action_apply_changes(self):
        """Applica la patch changes_applied al deal e crea snapshot.

        30/09/2026 (F1): quando un evento contiene una patch strutturata
        (es. cambio prezzo), questa viene applicata al deal e genera uno
        snapshot versionato. Così la fotografia corrente è sempre coerente
        con la storia.
        """
        self.ensure_one()
        if not self.changes_applied:
            raise UserError('Nessuna modifica da applicare su questo evento.')
        if not isinstance(self.changes_applied, dict):
            raise UserError('Formato changes_applied non valido (atteso oggetto).')

        deal = self.deal_id
        # Patch pulita (senza i wrapper {"from":X,"to":Y})
        patch = {}
        for field_name, change in self.changes_applied.items():
            if isinstance(change, dict) and 'to' in change:
                patch[field_name] = change['to']
            else:
                patch[field_name] = change

        # Applica sul deal (senza triggerare snapshot automatico — lo
        # creiamo manualmente qui sotto con il trigger_event corretto)
        deal.with_context(_skip_snapshot=True).write(patch)

        # Snapshot versionato con riferimento a questo evento
        deal._create_snapshot(trigger_event=self)

        # Log
        deal.message_post(body=f"Evento '{self.title}': modifica applicata a {', '.join(patch.keys())}")

        return True
