import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6ProjectEmailLog(models.Model):
    """Log grezzo delle email captate sugli alias di progetto sotto il
    catch-all v6sviluppoimpresa.it, qualunque sia il progetto (TEE, o
    altri futuri sulla stessa infrastruttura). NESSUNA estrazione AI qui
    per scelta esplicita del prompt -- solo mittente/destinatari/oggetto
    come campi, corpo e allegati restano nel chatter nativo (message_ids),
    popolato automaticamente da mail.thread.message_process() dopo
    message_new(). Instradato qui dal fetchmail.server puntato sulla
    casella IMAP unica (catchall@v6sviluppoimpresa.it).

    La decisione di instradamento (Fase 2.3) e' delegata al nodo AEOSV6
    'route_project_email' (aeosv6_dispatch.py) via run_process() -- il
    grafo guida DAVVERO l'esecuzione: disattivare quel nodo fa fallire
    message_new() esplicitamente, non instrada silenziosamente."""
    _name = 'erpv6.project.email.log'
    _description = 'Email Progetti (log grezzo, catch-all v6sviluppoimpresa.it)'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    name = fields.Char(string='Oggetto', required=True, default=lambda self: _('(nessun oggetto)'))
    sender_email = fields.Char(string='Mittente')
    recipient_emails = fields.Char(string='Destinatari (To)')
    cc_emails = fields.Char(string='Destinatari (Cc)')

    match_status = fields.Selection([
        ('matched', 'Collegata a nodo progetto'),
        ('alias_riconosciuto_nodo_mancante', 'Alias su v6sviluppoimpresa.it riconosciuto, nessun nodo collegato'),
        ('non_pattern_tee', 'Non un alias di progetto (rumore catch-all)'),
    ], string='Stato Riconoscimento', required=True, default='non_pattern_tee')

    matched_alias = fields.Char(string='Alias Riconosciuto')
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Nodo Progetto', tracking=True,
    )
    recipient_relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Parte Destinataria', tracking=True,
        help="Altra parte collegata allo stesso progetto riconosciuta tra i "
             "destinatari (To/Cc) dell'email, diversa dal mittente -- "
             "risponde a 'a chi ha scritto' il mittente. Vuoto se non "
             "riconosciuta (es. mittente ha scritto solo al progetto).",
    )

    @api.model
    def message_new(self, msg_dict, custom_values=None):
        custom_values = dict(custom_values or {})

        node = self.env.ref('aeosv6_project_relay.node_route_project_email')
        execution = node.run_process({
            'to': msg_dict.get('to') or '',
            'cc': msg_dict.get('cc') or '',
            'from': msg_dict.get('from') or '',
        })
        output = execution.output_data or {}

        custom_values['match_status'] = output.get('match_status', 'non_pattern_tee')
        custom_values['matched_alias'] = output.get('matched_alias') or False
        if output.get('relation_id'):
            custom_values['relation_id'] = output['relation_id']
        if output.get('recipient_relation_id'):
            custom_values['recipient_relation_id'] = output['recipient_relation_id']

        custom_values['name'] = msg_dict.get('subject') or _('(nessun oggetto)')
        custom_values['sender_email'] = msg_dict.get('from')
        custom_values['recipient_emails'] = msg_dict.get('to')
        custom_values['cc_emails'] = msg_dict.get('cc')

        thread_id = super().message_new(msg_dict, custom_values=custom_values)

        # 07/09/2026 (prompt "Dashboard: quarta tab Amministrazione /
        # PARTE B", notifiche email): notify_new_email() vive in
        # erpv6_winwin_renderdata (estende erpv6.tracking.relation li',
        # non qui - aeosv6_project_relay non dipende e non deve dipendere
        # da erpv6_winwin_renderdata, che dipende gia' da questo modulo:
        # dipendenza circolare altrimenti, stesso problema gia' scoperto
        # e corretto per group_project_relation_manager in un giro
        # precedente). getattr() difensivo: se erpv6_winwin_renderdata
        # non fosse installato, il log TEE resta comunque funzionante
        # senza questa notifica, mai un errore per un metodo assente.
        if custom_values.get('relation_id'):
            relation = self.env['erpv6.tracking.relation'].sudo().browse(custom_values['relation_id'])
            notify = getattr(relation, 'notify_new_email', None)
            if notify:
                try:
                    notify(custom_values['name'], custom_values.get('sender_email'))
                except Exception:
                    # Best-effort: mai un rollback qui, cancellerebbe
                    # anche il log gia' salvato sopra.
                    _logger.exception(
                        "notify_new_email fallita (best-effort) per erpv6.project.email.log, "
                        "relation_id=%s - il salvataggio dell'email resta comunque valido.",
                        custom_values['relation_id'],
                    )

        return thread_id

    def action_open_reply_wizard(self):
        """Apre il wizard 'Invia Email dal Progetto' precompilato per
        rispondere a questa email loggata (Denis, 10/09/2026: 'non riesco
        piu inviare una email da dentro al progetto, ora che le hai
        divise dal progetto' -- il bottone di invio e' sempre esistito
        solo sulla scheda erpv6.tracking.relation, MAI su questo log,
        quindi aprendo un'email captata qui non c'era alcun modo di
        rispondere senza uscire e cercare la scheda del progetto a mano.
        Il bottone qui chiude quel salto: riusa lo stesso wizard/nodo
        gia' esistente, non ne inventa uno nuovo)."""
        self.ensure_one()
        if not self.relation_id:
            raise UserError(_(
                "Questa email non e' collegata a nessun progetto riconosciuto "
                "(stato: %s) -- non posso determinare da quale alias rispondere."
            ) % (self.match_status or ''))
        root = self.relation_id
        while root.parent_id:
            root = root.parent_id
        return {
            'type': 'ir.actions.act_window',
            'name': 'Invia Email dal Progetto',
            'res_model': 'erpv6.project.relay.send.email.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_project_id': root.id,
                'default_subject': _('Re: %s') % (self.name or ''),
                'default_extra_emails': self.sender_email or '',
            },
        }
