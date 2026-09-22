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
        ('utente_consulente', 'Collegata a consulente V6'),
        ('alias_riconosciuto_progetto_mancante', 'Alias su v6impresa.it riconosciuto, nessun progetto collegato'),
        ('non_pattern_progetto', 'Non un alias di progetto (rumore catch-all)'),
    ], string='Stato Riconoscimento', required=True, default='non_pattern_progetto')

    direction = fields.Selection([
        ('ricevuta', 'Ricevuta'),
        ('inviata', 'Inviata'),
    ], string='Direzione', default='ricevuta', required=True)

    # 22/09/2026: campo 'letto' per il badge email non lette.
    # Le email in USCITA vengono create con is_read=True (l'utente
    # le ha scritte lui). Le entranti partono False.
    is_read = fields.Boolean(string='Letta', default=False, index=True)

    matched_alias = fields.Char(string='Alias Riconosciuto')
    relation_id = fields.Many2one('erpv6.tracking.relation', string='Nodo Progetto', tracking=True)
    # 20/09/2026: se il TO contiene uno slug utente (es. christian.girardi@v6impresa.it)
    # l'email viene attribuita al consulente.
    recipient_user_id = fields.Many2one('res.users', string='Destinatario Consulente', tracking=True)

    @api.model
    def message_new(self, msg_dict, custom_values=None):
        custom_values = dict(custom_values or {})

        to_field = msg_dict.get('to') or ''
        cc_field = msg_dict.get('cc') or ''
        from_field = msg_dict.get('from') or ''

        candidates = [m.group(1).lower() for m in DOMAIN_EMAIL_RE.finditer(f'{to_field} {cc_field}')]

        # 21/09/2026: routing email in 3 casi.
        # Formato supportato: slug@v6impresa.it (personale) oppure
        # slug+progetto@v6impresa.it (email di progetto indirizzata al consulente).
        User = self.env['res.users'].sudo()
        Relation = self.env['erpv6.tracking.relation'].sudo()
        recipient_user = User
        recipient_matched = False
        project_from_hint = Relation

        for alias in candidates:
            # Split su '+' per gestire slug+hint
            if '+' in alias:
                slug, hint = alias.split('+', 1)
            else:
                slug, hint = alias, None

            u = User.search([('email_slug', '=', slug)], limit=1)
            if u:
                recipient_user = u
                recipient_matched = alias
                # Se c'e' un hint (es. 'tee'), cerca il progetto per email_alias
                if hint:
                    proj = Relation.search(
                        [('email_alias', '=', hint), ('parent_id', '=', False)],
                        limit=1)
                    if proj:
                        project_from_hint = proj
                break

        if recipient_user:
            custom_values['match_status'] = 'utente_consulente'
            custom_values['matched_alias'] = recipient_matched
            custom_values['recipient_user_id'] = recipient_user.id
            if project_from_hint:
                custom_values['relation_id'] = project_from_hint.id
            custom_values['name'] = msg_dict.get('subject') or _('(nessun oggetto)')
            custom_values['sender_email'] = msg_dict.get('from')
            custom_values['recipient_emails'] = msg_dict.get('to')
            custom_values['cc_emails'] = msg_dict.get('cc')

            thread_id = super().message_new(msg_dict, custom_values=custom_values)

            try:
                recipient_user.partner_id.message_post(
                    body=f"Nuova email da {custom_values['sender_email']} - Oggetto: {custom_values['name']}",
                    subject=f"[Email] {custom_values['name']}",
                    message_type='notification',
                )
            except Exception:
                _logger.exception("Notifica email consulente fallita (best-effort)")

            return thread_id

        # Fallback: logica progetto esistente (email a progetto-xxx@)
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
