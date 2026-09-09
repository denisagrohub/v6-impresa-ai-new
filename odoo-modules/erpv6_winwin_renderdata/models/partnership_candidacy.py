# -*- coding: utf-8 -*-
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6PartnershipCandidacy(models.Model):
    """Candidatura partnership (09/09/2026, prompt 'Candidatura partnership
    + routing token prodotto + rotazione claim homepage', Parte A).

    Scope volutamente minimo (esplicito nel prompt): raccoglie interesse,
    non apre nessun accesso al sistema - nessun portale, nessuna
    autenticazione nuova, nessun consulente creato automaticamente.

    Modello dedicato invece di riusare res.partner + categoria (pattern
    gia' usato per i referral, vedi ResPartnerReferralAdmin in
    admin_dashboard_extension.py): un referral e' solo un'anagrafica,
    una candidatura porta anche un testo libero di proposta che non ha
    un campo naturale su res.partner - verificato prima di scrivere
    questo modello (CLAUDE.md, "verifica se esiste gia' un motore
    generico riusabile").

    _inherit mail.thread: serve solo per poter usare message_notify()
    diretto verso Denis (stesso schema gia' corretto e verificato dal
    vivo per 'prendi in carico', vedi
    booking_token_extension.py/action_prendi_in_carico) - MAI passare da
    erpv6.agent.communication/create_and_route() per una notifica che
    deve raggiungere una persona specifica, quel canale ricade sempre su
    base.user_admin quando il destinatario non ha notify_partner_ids
    configurato (causa gia' isolata e corretta altrove in questo stesso
    circuito)."""
    _name = 'erpv6.partnership.candidacy'
    _description = 'Candidatura Partnership'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    name = fields.Char(string='Nome Referente', required=True, tracking=True)
    company_name = fields.Char(string='Azienda', tracking=True)
    email = fields.Char(string='Email', required=True, tracking=True)
    phone = fields.Char(string='Telefono')
    proposal = fields.Text(
        string='Proposta di Collaborazione',
        help="Testo libero del referente - descrizione della proposta di partnership/collaborazione.",
    )

    state = fields.Selection([
        ('nuova', 'Nuova'),
        ('in_valutazione', 'In Valutazione'),
        ('archiviata', 'Archiviata'),
    ], string='Stato', required=True, default='nuova', tracking=True)

    @api.model
    def action_create_from_public_form(self, name, company_name=None, email=None, phone=None, proposal=None):
        """Punto di ingresso unico dal form pubblico (chiamato sudo() dal
        controller pubblico erpv6_api_gateway/controllers/partnership_api.py,
        stesso schema di isolamento env-utente-pubblico di lead_api.py:
        nessuna scrittura anonima diretta sul modello dal controller,
        passa sempre da qui)."""
        name = (name or '').strip()
        email = (email or '').strip()
        if not name or not email:
            raise UserError(_("Nome ed email sono obbligatori."))

        candidacy = self.sudo().create({
            'name': name,
            'company_name': (company_name or '').strip() or False,
            'email': email,
            'phone': (phone or '').strip() or False,
            'proposal': (proposal or '').strip() or False,
        })
        candidacy._notify_denis()
        return {'id': candidacy.id}

    def _notify_denis(self):
        """Notifica diretta forzata in-app verso Denis (base.user_admin) -
        NON verso group_system in generale (potrebbe crescere in futuro,
        oggi e' comunque una sola persona reale che decide su queste
        candidature, coerente con RESPONSABILE_GROUPS/decisioni umane
        gia' viste altrove in erpv6_production/consulente_assignment.py).
        Stesso trucco di forzatura mail.notification a notification_type
        'inbox' gia' verificato dal vivo in
        erpv6.tracking.relation.notify_owner() - duplicato qui (6 righe,
        non un motore) perche' quel metodo vive su un modello diverso e
        non e' un mixin condiviso ad oggi."""
        self.ensure_one()
        admin_user = self.env.ref('base.user_admin', raise_if_not_found=False)
        partner = admin_user.partner_id if admin_user else False
        if not partner:
            _logger.warning(
                "Candidatura partnership #%s creata ma base.user_admin non trovato - nessuna notifica inviata.",
                self.id,
            )
            return False
        message = self.message_notify(
            partner_ids=partner.ids,
            subject=_('Nuova candidatura partnership: %s') % self.name,
            body=_(
                'Nuova candidatura partnership da %(nome)s (%(azienda)s, %(email)s).<br/>'
                'Proposta: %(proposta)s'
            ) % {
                'nome': self.name,
                'azienda': self.company_name or '-',
                'email': self.email,
                'proposta': (self.proposal or '-')[:500],
            },
        )
        if message:
            notif = self.env['mail.notification'].sudo().search([
                ('mail_message_id', '=', message.id),
                ('res_partner_id', '=', partner.id),
            ], limit=1)
            if notif:
                notif.write({'notification_type': 'inbox', 'is_read': False})
        return True

    @api.model
    def action_set_state_from_dashboard(self, candidacy_id, state):
        """Cambio stato dalla tab Amministrazione - stesso controllo
        server-side group_system delle altre azioni admin di questo
        stesso file/tab (vedi admin_dashboard_extension.py), mai un
        nascondimento solo-frontend."""
        if not self.env.user.has_group('base.group_system'):
            raise UserError(_("Solo un amministratore puo' modificare lo stato di una candidatura."))
        if state not in dict(self._fields['state'].selection):
            raise UserError(_("Stato non valido: %s") % state)
        candidacy = self.sudo().browse(int(candidacy_id))
        if not candidacy.exists():
            raise UserError(_("Candidatura non trovata."))
        candidacy.write({'state': state})
        return {'id': candidacy.id, 'state': candidacy.state}
