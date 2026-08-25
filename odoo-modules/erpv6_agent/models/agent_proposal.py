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
                proposal._chain_to_next_agent_if_needed()
        return result

    def _next_chain_agent_code(self):
        """Codice dell'agente che si occupera' DAVVERO di questa proposta
        una volta approvata -- UNA sola funzione, usata sia da
        _chain_to_next_agent_if_needed (per decidere a chi incatenare) sia
        da erpv6.agent.telegram.config._handle_proposal_decision (per dire
        a Denis chi se ne occupa), cosi' le due cose non possono
        disallinearsi. Fattorizzata il 25/08/2026 dopo aver trovato dal
        vivo un bug reale in _handle_proposal_decision: il messaggio di
        conferma diceva il nome del CANALE Telegram che aveva approvato
        (es. 'Susanna', che puo' approvare proposte di chiunque) invece
        del nome dell'agente che avrebbe davvero applicato la modifica.

        Caso normale (invariato dal 24/08/2026): il prossimo agente e'
        Claudio. Claudio e Alessandro stessi sono agenti TERMINALI (nessun
        ulteriore incatenamento, se ne occupano loro).

        Caso escalation Alessandro (25/08/2026, design concordato con
        Denis la sera del 24/08/2026, vedi memoria
        project_alessandro_agent_design.md): SE questa proposta appartiene
        a Kaizen E il suo parent_proposal_id appartiene a Claudio,
        significa che e' la proposta di escalation creata da
        erpv6.kaizen.detected_signal._maybe_escalate_to_alessandro quando
        una proposta di Claudio resta bloccata (mai 'actioned') --
        approvarla NON deve rimandare la stessa richiesta a Claudio (si
        bloccherebbe di nuovo per lo stesso motivo, rischio di loop
        silenzioso): il prossimo agente e' invece Alessandro, che ha
        strumenti piu' ampi (ricerca nel codice/nel grafo, azioni non-diff)
        per i casi troppo astratti per un diff su un file nominato."""
        self.ensure_one()
        if self.agent_config_id.code in ('claudio', 'alessandro'):
            return self.agent_config_id.code
        if self.agent_config_id.code == 'kaizen' and self.parent_proposal_id.agent_config_id.code == 'claudio':
            return 'alessandro'
        return 'claudio'

    def _chain_to_next_agent_if_needed(self):
        """Crea (se non esiste gia') una proposta di verifica/applicazione
        per il prossimo agente della catena (vedi _next_chain_agent_code),
        incatenata e gia' accettata, per QUALUNQUE proposta approvata che
        non sia gia' di un agente terminale (Claudio o Alessandro) -- cosi'
        il ciclo automatico (watch_proposals.py, che guarda le proposte
        accettate di Claudio E Alessandro) la trova al giro successivo
        senza altro intervento umano oltre all'approvazione originale.
        Generalizzata il 25/08/2026 da _chain_to_claudio_if_needed per
        includere Alessandro (vedi _next_chain_agent_code per il caso
        escalation)."""
        self.ensure_one()
        if self.agent_config_id.code in ('claudio', 'alessandro'):
            return
        next_code = self._next_chain_agent_code()
        if self.child_proposal_ids.filtered(lambda c: c.agent_config_id.code == next_code):
            return  # gia' incatenata (es. scritta da _handle_proposal_decision in passato)
        next_agent = self.env['erpv6.agent.config'].sudo().search([('code', '=', next_code)], limit=1)
        if not next_agent:
            return
        reviewer = self.reviewer_id or self.env.ref('base.user_admin', raise_if_not_found=False) or self.env.user
        if next_code == 'alessandro':
            proposal_text = _(
                "Denis ha confermato: Claudio non ce l'ha fatta su questa proposta (rimasta "
                "bloccata, mai attuata). Prova tu -- hai strumenti piu' ampi di Claudio: ricerca "
                "nel codice/nel grafo Neo4j per capire DOVE intervenire, ed eventualmente un'azione "
                "non-diff (voce KB, configurazione) se il fix non e' letteralmente un file da "
                "editare. %(text)s"
            ) % {'text': self.proposal_text}
        else:
            proposal_text = _(
                "Denis ha approvato questa proposta di %(agent)s: %(text)s\n\n"
                "Verifica sul codice reale se e come applicarla correttamente, poi applicala davvero."
            ) % {'agent': self.agent_config_id.name, 'text': self.proposal_text}
        self.env['erpv6.agent.proposal'].sudo().create({
            'agent_config_id': next_agent.id,
            'name': _("Verifica e applica: %s") % self.name,
            'proposal_text': proposal_text,
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
