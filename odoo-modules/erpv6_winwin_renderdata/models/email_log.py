import logging
import re
from email.utils import getaddresses, parseaddr

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


# Stesso pattern hub-email gia' verificato per il Progetto TEE
# (aeosv6_project_relay/models/aeosv6_dispatch.py, dominio
# v6sviluppoimpresa.it) - qui riproposto per v6impresa.it. Non e' un
# riuso diretto del modulo TEE (aeosv6_project_relay e' lavoro non
# committato di un altro thread, non va toccato/dipeso da esso), e il
# regex e' comunque hardcoded sul dominio in quel modulo - qui si
# riusa il PATTERN architetturale (alias di progetto sul nodo radice,
# riconoscimento mittente sui nodi figlio), non il codice.
DOMAIN_EMAIL_RE = re.compile(r'([a-z0-9][a-z0-9._+\-]*)@v6impresa\.it', re.IGNORECASE)


class Erpv6WinwinEmailLog(models.Model):
    """Log grezzo delle email captate sul catch-all v6impresa.it per i
    progetti Win-Win (06/09/2026, prompt 'Trigger progetto + Dashboard
    consulente + Email per-progetto'). Semplificato rispetto al pattern
    TEE completo: qui manca il riconoscimento esplicito del
    DESTINATARIO (solo mittente) - debito tecnico dichiarato, aggiungibile
    con lo stesso schema di aeosv6_dispatch.py (TEE) se servira'."""
    _name = 'erpv6.winwin.email.log'
    _description = 'Email Progetti Win-Win (log grezzo, catch-all v6impresa.it)'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    name = fields.Char(string='Oggetto', required=True, default=lambda self: _('(nessun oggetto)'))
    sender_email = fields.Char(string='Mittente')
    recipient_emails = fields.Char(string='Destinatari (To)')
    cc_emails = fields.Char(string='Destinatari (Cc)')

    match_status = fields.Selection([
        ('matched', 'Collegata a progetto'),
        ('alias_riconosciuto_progetto_mancante', 'Alias su v6impresa.it riconosciuto, nessun progetto collegato'),
        ('non_pattern_progetto', 'Non un alias di progetto (rumore catch-all)'),
    ], string='Stato Riconoscimento', required=True, default='non_pattern_progetto')

    matched_alias = fields.Char(string='Alias Riconosciuto')
    relation_id = fields.Many2one('erpv6.tracking.relation', string='Nodo Progetto', tracking=True)

    @api.model
    def message_new(self, msg_dict, custom_values=None):
        custom_values = dict(custom_values or {})

        to_field = msg_dict.get('to') or ''
        cc_field = msg_dict.get('cc') or ''
        from_field = msg_dict.get('from') or ''

        candidates = [m.group(1).lower() for m in DOMAIN_EMAIL_RE.finditer(f'{to_field} {cc_field}')]

        Relation = self.env['erpv6.tracking.relation'].sudo()
        project = Relation
        matched_alias = False
        for alias in candidates:
            # ('production_order_id', '!=', False): resta scoped ai nodi
            # Win-Win, non collide con gli alias TEE sullo stesso modello
            # condiviso (dominio email gia' li separa nella pratica, ma
            # il filtro esplicito evita qualunque ambiguita' se due
            # progetti su domini diversi avessero per coincidenza lo
            # stesso slug).
            project = Relation.search(
                [('email_alias', '=', alias), ('production_order_id', '!=', False)], limit=1)
            if project:
                matched_alias = alias
                break

        if project:
            relation = project
            sender_email = parseaddr(from_field)[1].strip().lower() if from_field else ''
            if sender_email and project.child_ids:
                child_match = project.child_ids.filtered(
                    lambda c: c.partner_id.email and c.partner_id.email.strip().lower() == sender_email
                )
                if child_match:
                    relation = child_match[0]
            custom_values['match_status'] = 'matched'
            custom_values['matched_alias'] = matched_alias
            custom_values['relation_id'] = relation.id
        elif candidates:
            custom_values['match_status'] = 'alias_riconosciuto_progetto_mancante'
            custom_values['matched_alias'] = candidates[0]
        else:
            custom_values['match_status'] = 'non_pattern_progetto'

        custom_values['name'] = msg_dict.get('subject') or _('(nessun oggetto)')
        custom_values['sender_email'] = msg_dict.get('from')
        custom_values['recipient_emails'] = msg_dict.get('to')
        custom_values['cc_emails'] = msg_dict.get('cc')

        thread_id = super().message_new(msg_dict, custom_values=custom_values)

        # 07/09/2026 (PARTE B, notifiche email): DOPO il salvataggio
        # riuscito, mai prima - non tocca il matching sopra.
        if custom_values.get('relation_id'):
            relation = self.env['erpv6.tracking.relation'].sudo().browse(custom_values['relation_id'])
            try:
                relation.notify_new_email(custom_values['name'], custom_values.get('sender_email'))
            except Exception:
                # Best-effort: una notifica fallita non deve mai far
                # fallire/annullare il salvataggio dell'email gia'
                # avvenuto sopra (mai un rollback qui - cancellerebbe
                # anche il log gia' creato).
                _logger.exception(
                    "notify_new_email fallita (best-effort) per erpv6.winwin.email.log, "
                    "relation_id=%s - il salvataggio dell'email resta comunque valido.",
                    custom_values['relation_id'],
                )

        return thread_id
