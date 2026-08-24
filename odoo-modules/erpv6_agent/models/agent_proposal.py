from datetime import timedelta

from odoo import _, fields, models


class Erpv6AgentProposal(models.Model):
    """Proposta generata da un qualunque agente registrato (erpv6.agent.config):
    SEMPRE in attesa di revisione umana, mai auto-applicata -- stesso
    principio del gate umano gia' seguito ovunque in questo progetto
    (validazione 6 Giudici, README auto-fix mai costruito: 'il merge lo fai
    sempre tu'). Generalizzato da erpv6.kaizen.ai_proposal (erpv6_kaizen,
    primo agente reale) il 20/08/2026."""
    _name = 'erpv6.agent.proposal'
    _description = 'Proposta Agente AI'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    # ondelete='cascade': cancellare un agente deve cancellare tutto cio'
    # che gli appartiene -- segnalato dal vivo dall'utente il 20/08/2026
    # ("cancello l'agente si cancella tutto"). Senza questo, required=True
    # senza ondelete esplicito avrebbe fatto fallire la cancellazione
    # dell'agente con un errore di integrita' referenziale appena esisteva
    # anche una sola proposta.
    agent_config_id = fields.Many2one('erpv6.agent.config', string='Agente', required=True, index=True, ondelete='cascade')
    name = fields.Char(string='Titolo', required=True, tracking=True)
    proposal_text = fields.Text(string='Proposta', required=True, tracking=True)
    based_on = fields.Text(string='Basata su', help="Riepilogo dei dati usati per generare la proposta.")
    rule_applied = fields.Char(string='Regola applicata', help="Riferimento alla voce KB di istruzioni citata dall'AI.")
    provider_name = fields.Char(string='Provider AI', readonly=True)
    # Aggiunti il 24/08/2026 per la catena Kaizen -> Claudio -> Argus
    # (piano "Claudio+Argus", riconciliato con l'architettura esistente:
    # niente formato di relazione a parte, il testo integrale verificato
    # vive qui come documento, la sintesi/instradamento resta su
    # erpv6.agent.communication). technical_report_id per il caso lungo
    # (comandi eseguiti, output reale, non solo la sintesi in proposal_text);
    # parent_proposal_id per incatenare una proposta alla precedente che sta
    # verificando/correggendo/controllando.
    technical_report_id = fields.Many2one(
        'erpv6.library.document', string='Relazione Tecnica Completa',
        help="Documento (categoria 'agent_knowledge') con la relazione tecnica integrale: "
             "cosa verificato (file:riga, comando, output reale), cosa concluso e perche', "
             "cosa proposto. Opzionale: solo per proposte con verifica lunga/dettagliata, "
             "la sintesi resta comunque in proposal_text/based_on.")
    parent_proposal_id = fields.Many2one(
        'erpv6.agent.proposal', string='Proposta precedente nella catena', ondelete='set null',
        help="Collega la proposta di verifica/correzione (es. Claudio) a quella originale "
             "che sta controllando (es. Kaizen), o quella di verifica finale (es. Argus) a "
             "quella applicata che sta controllando.")
    child_proposal_ids = fields.One2many('erpv6.agent.proposal', 'parent_proposal_id', string='Proposte successive nella catena')
    status = fields.Selection([
        ('pending_review', 'In attesa di revisione'),
        ('accepted', 'Accettata'),
        ('rejected', 'Rifiutata'),
        ('actioned', 'Attuata manualmente'),
    ], string='Stato', default='pending_review', required=True, tracking=True)
    reviewer_id = fields.Many2one('res.users', string='Revisionata da', tracking=True)
    reviewed_at = fields.Datetime(string='Revisionata il', tracking=True)
    review_notes = fields.Text(string='Note del revisore')

    def write(self, vals):
        """Bug reale trovato il 24/08/2026 (proposta #18 di Kaizen,
        approvata da Denis nell'interfaccia Odoo, MAI arrivata a Claudio):
        la catena automatica verso Claudio viveva SOLO dentro il gestore
        dei bottoni Telegram (_handle_proposal_decision), non
        nell'accettazione vera e propria -- quindi approvare da Odoo
        (wizard _do_accept) o da qualunque altra via futura non la faceva
        mai scattare. Spostata qui, a livello di modello: qualunque
        scrittura che porta status a 'accepted' la fa scattare, sempre,
        indipendentemente da chi/come ha approvato."""
        was_pending = {p.id: p.status for p in self} if 'status' in vals else {}
        result = super().write(vals)
        if vals.get('status') == 'accepted':
            for proposal in self:
                if was_pending.get(proposal.id) == 'accepted':
                    continue  # gia' accettata prima di questa write, non ricatenare
                proposal._chain_to_claudio_if_needed()
        return result

    def _chain_to_claudio_if_needed(self):
        """Crea (se non esiste gia') una proposta di verifica/applicazione
        per Claudio, incatenata e gia' accettata, per QUALUNQUE proposta
        approvata che non sia gia' di Claudio stesso -- cosi' il ciclo
        automatico (watch_proposals.py, che guarda solo le proposte
        accettate di Claudio) la trova al giro successivo senza altro
        intervento umano oltre all'approvazione originale."""
        self.ensure_one()
        if self.agent_config_id.code == 'claudio':
            return
        if self.child_proposal_ids.filtered(lambda c: c.agent_config_id.code == 'claudio'):
            return  # gia' incatenata (es. scritta da _handle_proposal_decision in passato)
        claudio = self.env['erpv6.agent.config'].sudo().search([('code', '=', 'claudio')], limit=1)
        if not claudio:
            return
        reviewer = self.reviewer_id or self.env.ref('base.user_admin', raise_if_not_found=False) or self.env.user
        self.env['erpv6.agent.proposal'].sudo().create({
            'agent_config_id': claudio.id,
            'name': _("Verifica e applica: %s") % self.name,
            'proposal_text': _(
                "Denis ha approvato questa proposta di %(agent)s: %(text)s\n\n"
                "Verifica sul codice reale se e come applicarla correttamente, poi applicala davvero."
            ) % {'agent': self.agent_config_id.name, 'text': self.proposal_text},
            'parent_proposal_id': self.id,
            'status': 'accepted',
            'reviewer_id': reviewer.id,
            'reviewed_at': fields.Datetime.now(),
        })

    def action_accept(self):
        """Apre il popup di assegnazione invece di accettare direttamente:
        "chi accetta" (fa il gate umano) non e' detto sia "chi esegue" il
        lavoro -- segnalato dal vivo dall'utente il 20/08/2026, vanno scelti
        separatamente. La vera accettazione avviene in _do_accept, chiamata
        dal wizard dopo la scelta dell'assegnatario."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _("Assegna ed accetta"),
            'res_model': 'erpv6.agent.proposal.accept_wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_proposal_id': self.id},
        }

    def _do_accept(self, assignee):
        """'Accetta' non deve restare un semplice cambio di stato --
        segnalato dal vivo dall'utente il 20/08/2026 ("mi aspettavo piu' di
        un click"): crea SEMPRE un'attivita' To-Do vera assegnata a chi
        esegue davvero (non per forza chi ha accettato), con la proposta
        come nota, PIU' una notifica diretta ("deve apparire un allarme
        popup che dice chi deve fare il lavoro") cosi' l'assegnatario la
        vede subito. Resta comunque un gate umano: non esegue la proposta
        da sola (nessuna scrittura su modelli/schema), solo la trasforma in
        un compito da fare."""
        self.ensure_one()
        self.write({'status': 'accepted', 'reviewer_id': self.env.user.id, 'reviewed_at': fields.Datetime.now()})
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=_("Attuare proposta: %s") % self.name,
            note=self.proposal_text,
            user_id=assignee.id,
            date_deadline=fields.Date.context_today(self) + timedelta(days=3),
        )
        if assignee.partner_id:
            # email_from esplicito: senza, message_notify finirebbe con
            # mittente "OdooBot <odoobot@example.com>" invece del mittente
            # aziendale -- stesso fix gia' applicato piu' volte stanotte
            # (digest, certificato).
            default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from')
            notify_kwargs = {}
            if default_from:
                notify_kwargs['email_from'] = '"%s" <%s>' % (self.env.company.name, default_from)
            self.message_notify(
                partner_ids=assignee.partner_id.ids,
                subject=_("Lavoro assegnato: %s") % self.name,
                body=_("%(reviewer)s ti ha assegnato questo lavoro (proposta accettata):\n\n%(text)s") % {
                    'reviewer': self.env.user.name, 'text': self.proposal_text},
                **notify_kwargs,
            )

    def action_reject(self):
        for proposal in self:
            proposal.write({
                'status': 'rejected', 'reviewer_id': self.env.user.id, 'reviewed_at': fields.Datetime.now(),
            })

    def action_mark_actioned(self):
        for proposal in self:
            proposal.write({
                'status': 'actioned', 'reviewer_id': self.env.user.id, 'reviewed_at': fields.Datetime.now(),
            })
