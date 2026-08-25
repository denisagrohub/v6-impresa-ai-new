import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# "Responsabile o Admin" (Denis, 25/08/2026): mai un Consulente da solo, in
# autonomia, ne' per riassegnare manualmente (action_reassign_consulente) ne'
# per approvare/rifiutare un'eccezione (Erpv6ConsulenteRichiesta.action_approve/
# action_reject). Nessun nuovo gruppo inventato: sales_team.group_sale_manager
# (gia' installato con crm/sales_team) copre "Responsabile commerciale",
# base.group_system copre "Admin" - stessa doppia porta gia' usata altrove nel
# progetto per azioni riservate a un umano con autorita'.
RESPONSABILE_GROUPS = ('sales_team.group_sale_manager', 'base.group_system')


def _is_responsabile_o_admin(env):
    return any(env.user.has_group(g) for g in RESPONSABILE_GROUPS)


def _check_responsabile_o_admin(env, action_description):
    if not _is_responsabile_o_admin(env):
        raise UserError(_(
            "Solo un Responsabile o l'Admin possono %s - un Consulente non puo' farlo da solo, "
            "in autonomia."
        ) % action_description)


class Erpv6ProductionConsulenteLine(models.Model):
    """Riga (lead, partecipante, ruolo, percentuale) - Denis, 25/08/2026:
    "servono anche delle assegnazioni del tipo che puo' accadere lead
    portato da Stefano ma lavorato da Martina perche' poi tutti i
    consulenti nella pipeline hanno una percentuale di compenso". Un
    crm.lead.user_id resta il "consulente di riferimento" (retrocompatibile
    con le record rule esistenti, vedi erpv6_production_security_rules.xml)
    ma il compenso e i ruoli multipli vivono qui, una riga per partecipante.

    Il partecipante NON e' sempre un consulente vero: il ruolo 'referral'
    (Denis, 25/08/2026 - "un direttore di banca ci passa il lead, non fa
    nessun lavoro, ma potrebbe volere una percentuale per aver passato il
    contatto") e' un res.partner esterno qualsiasi, senza login, mai
    soggetto alle regole di competenza/zona/assegnazione automatica sotto
    (quelle si applicano SOLO a chi deve davvero lavorare il lead,
    sourcing/delivery). Percentuale lasciata a 0/non definita finche' un
    umano non la imposta - mai una percentuale inventata qui, il calcolo
    vero dei compensi e' un pezzo successivo, non richiesto in questo giro.
    """
    _name = 'erpv6.production.consulente.line'
    _description = "Produzione - Partecipante al lead (ruolo e percentuale compenso)"
    _order = 'id'

    lead_id = fields.Many2one('crm.lead', string='Lead', required=True, ondelete='cascade', index=True)
    role = fields.Selection([
        ('sourcing', 'Portato da (sourcing)'),
        ('delivery', 'Lavorato da (delivery)'),
        ('referral', 'Segnalatore esterno (referral)'),
    ], string='Ruolo', required=True, default='delivery')

    # Un consulente vero (sourcing/delivery): stesso gruppo/dominio di
    # crm.lead.user_id. Vuoto per role='referral' (vedi _check_partecipante).
    user_id = fields.Many2one(
        'res.users', string='Consulente',
        domain=lambda self: [('groups_id', 'in', self.env.ref('erpv6_core.group_consulente').ids)])
    # Referral esterno: qualunque res.partner, mai un consulente con login -
    # vuoto per role in (sourcing, delivery).
    referral_partner_id = fields.Many2one('res.partner', string='Referral (contatto esterno)')

    percentuale = fields.Float(
        string='Percentuale compenso (%)', default=0.0,
        help="0 = non ancora definita. Il calcolo vero dei compensi/fatturazione non e' ancora "
             "implementato (Denis, 25/08/2026): questo campo esiste solo perche' il modello dati "
             "regga fin da ora piu' partecipanti con percentuale sullo stesso lead.")
    assignment_reason = fields.Selection([
        ('storico', 'Storico cliente'),
        ('zona', 'Zona di competenza'),
        ('manuale', 'Assegnazione manuale del responsabile'),
        ('richiesta_consulente', 'Richiesta del consulente, approvata dal responsabile'),
        ('fallback_team', 'Fallback round-robin sul team - verifica manuale richiesta'),
    ], string='Motivo assegnazione', help="Vuoto per le righe inserite a mano (es. referral).")
    note = fields.Char(string='Nota')

    @api.constrains('role', 'user_id', 'referral_partner_id')
    def _check_partecipante(self):
        for line in self:
            if line.role == 'referral':
                if not line.referral_partner_id or line.user_id:
                    raise UserError(_(
                        "Una riga 'Segnalatore esterno (referral)' deve avere un contatto esterno "
                        "(referral_partner_id) e MAI un consulente (user_id)."))
            else:
                if not line.user_id or line.referral_partner_id:
                    raise UserError(_(
                        "Una riga 'Portato da'/'Lavorato da' deve avere un consulente (user_id) e MAI "
                        "un referral esterno."))

    _sql_constraints = [
        ('lead_user_role_unique', 'unique(lead_id, user_id, role)',
         "Questo consulente ha gia' questo ruolo su questo lead."),
    ]

    def name_get(self):
        result = []
        for line in self:
            who = line.user_id.name or line.referral_partner_id.name or '?'
            result.append((line.id, "%s (%s)" % (who, dict(self._fields['role'].selection).get(line.role))))
        return result


class Erpv6ConsulenteRichiesta(models.Model):
    """Eccezione richiesta da un consulente sui criteri 3/4 del brief:
    "il consulente puo' chiedere di essere assegnato ad un cliente
    particolare e o puo' chiedere di non venire assegnato". Un Consulente
    puo' SOLO creare la richiesta (stato 'in_attesa'): nessuna scrittura
    reale sull'assegnazione finche' un Responsabile o l'Admin non la
    approva esplicitamente (action_approve) - stesso gate umano proposta->
    conferma->azione gia' seguito ovunque nel progetto (Denis, 25/08/2026),
    applicato qui al livello di permesso giusto. Scope minimo: una
    richiesta e' sempre su UN lead specifico, non su "un tipo di cliente"
    in generale (andrebbe oltre quanto chiesto ora, vedi report finale)."""
    _name = 'erpv6.consulente.richiesta'
    _description = 'Consulente - Richiesta di assegnazione/esclusione su un lead'
    _inherit = ['erpv6.core.tracked']

    consulente_id = fields.Many2one(
        'res.users', string='Consulente', required=True, default=lambda self: self.env.user.id,
        domain=lambda self: [('groups_id', 'in', self.env.ref('erpv6_core.group_consulente').ids)])
    lead_id = fields.Many2one('crm.lead', string='Lead', required=True, ondelete='cascade')
    tipo = fields.Selection([
        ('assegnami', 'Vorrei essere assegnato a questo lead'),
        ('non_assegnarmi', 'Preferirei non essere assegnato a questo lead'),
    ], string='Richiesta', required=True)
    motivo = fields.Text(string='Motivo (facoltativo)')
    state = fields.Selection([
        ('in_attesa', 'In attesa'),
        ('approvata', 'Approvata'),
        ('rifiutata', 'Rifiutata'),
    ], default='in_attesa', required=True, tracking=True)
    responsabile_id = fields.Many2one('res.users', string='Deciso da', readonly=True, copy=False)
    decisione_note = fields.Text(string='Nota della decisione', readonly=True, copy=False)

    def write(self, vals):
        """Difesa in profondita' (Denis, 25/08/2026): "nessuna scrittura
        reale sull'assegnazione finche' un Responsabile/Admin non
        approva" - non deve bastare nascondere i bottoni approve/reject
        nella UI, un Consulente non deve poter scrivere 'state' (o la
        decisione) con una write ORM diretta bypassando action_approve/
        action_reject. Il valore 'in_attesa' iniziale (alla create) resta
        sempre permesso: solo un CAMBIO di stato e' bloccato qui."""
        if 'state' in vals or 'responsabile_id' in vals or 'decisione_note' in vals:
            _check_responsabile_o_admin(self.env, _("decidere lo stato di una richiesta di assegnazione"))
        return super().write(vals)

    def action_approve(self):
        """Solo Responsabile/Admin (vedi RESPONSABILE_GROUPS sopra) - un
        Consulente non puo' approvare nemmeno la propria richiesta."""
        for richiesta in self:
            _check_responsabile_o_admin(richiesta.env, _("approvare una richiesta di assegnazione"))
            if richiesta.state != 'in_attesa':
                raise UserError(_("Questa richiesta e' gia' stata decisa (%s).") % richiesta.state)
            if richiesta.tipo == 'assegnami':
                richiesta.lead_id._set_delivery_consulente(
                    richiesta.consulente_id, reason='richiesta_consulente',
                    note=_("Richiesta approvata da %s.") % self.env.user.name,
                )
            else:
                # 'non_assegnarmi': rimuove SOLO la riga di lavorazione
                # (delivery) di questo consulente su questo lead, se
                # esisteva - e resta come esclusione dichiarata: vedi
                # crm.lead._find_eligible_consulenti, che la consulta per
                # non riproporlo mai piu' in automatico su questo stesso lead.
                lead = richiesta.lead_id
                era_assegnatario = lead.user_id.id == richiesta.consulente_id.id
                delivery_line = self.env['erpv6.production.consulente.line'].search([
                    ('lead_id', '=', lead.id),
                    ('user_id', '=', richiesta.consulente_id.id),
                    ('role', '=', 'delivery'),
                ])
                delivery_line.unlink()
                # Lo stato 'approvata' va scritto SUBITO (sotto), prima di
                # ricalcolare: _find_eligible_consulenti legge solo le
                # richieste gia' 'approvata' per escludere il consulente.
                richiesta.write({
                    'state': 'approvata', 'responsabile_id': self.env.user.id,
                    'decisione_note': _("Approvata da %s il %s.") % (self.env.user.name, fields.Datetime.now()),
                })
                if era_assegnatario:
                    nuovo, motivo = lead._auto_assign_consulente()
                    if nuovo:
                        lead._set_delivery_consulente(nuovo, reason=motivo)
                    else:
                        lead.activity_schedule(
                            'mail.mail_activity_data_todo',
                            summary=_("VERIFICA MANUALE — %(consulente)s escluso dal lead, nessun sostituto "
                                      "automatico trovato (%(motivo)s): %(lead)s") % {
                                'consulente': richiesta.consulente_id.name, 'motivo': motivo, 'lead': lead.name},
                        )
                continue
            richiesta.write({
                'state': 'approvata',
                'responsabile_id': self.env.user.id,
                'decisione_note': _("Approvata da %s il %s.") % (self.env.user.name, fields.Datetime.now()),
            })

    def action_reject(self):
        for richiesta in self:
            _check_responsabile_o_admin(richiesta.env, _("rifiutare una richiesta di assegnazione"))
            if richiesta.state != 'in_attesa':
                raise UserError(_("Questa richiesta e' gia' stata decisa (%s).") % richiesta.state)
            richiesta.write({
                'state': 'rifiutata',
                'responsabile_id': self.env.user.id,
                'decisione_note': _("Rifiutata da %s il %s.") % (self.env.user.name, fields.Datetime.now()),
            })


class Erpv6ConsulenteReassignWizard(models.TransientModel):
    """Criterio 3 del brief: "un responsabile deve poter riassegnare
    manualmente (un'azione reale, non solo teorica)". Wizard minimo aperto
    da un bottone sul lead, visibile solo a Responsabile/Admin (vedi XML) -
    il controllo del permesso e' comunque ripetuto qui in action_confirm
    (mai fidarsi solo della visibilita' del bottone lato UI)."""
    _name = 'erpv6.consulente.reassign.wizard'
    _description = 'Riassegna manualmente il consulente di un lead'

    lead_id = fields.Many2one('crm.lead', string='Lead', required=True)
    new_user_id = fields.Many2one(
        'res.users', string='Nuovo consulente (lavorazione)', required=True,
        domain=lambda self: [('groups_id', 'in', self.env.ref('erpv6_core.group_consulente').ids)])
    motivo = fields.Char(string='Motivo della riassegnazione')

    def action_confirm(self):
        self.ensure_one()
        _check_responsabile_o_admin(self.env, _("riassegnare manualmente un consulente"))
        self.lead_id._set_delivery_consulente(
            self.new_user_id, reason='manuale',
            note=self.motivo or _("Riassegnato manualmente da %s.") % self.env.user.name,
        )
        return {'type': 'ir.actions.act_window_close'}
