import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# Campi obbligatori dello schema standard (Compito 4, 23/08/2026, dettato
# esplicitamente da Denis): chi, quando, quale azione, il problema, la
# valutazione Heinrich (Pareto/Kairos sono collegamenti facoltativi -- non
# tutte le comunicazioni hanno gia' un'analisi Pareto/Kairos strutturata,
# ma la severity' Heinrich e' SEMPRE richiesta perche' guida il routing,
# vedi Compito 3/route()), cosa crea, cosa cambia se non si fa nulla, la
# miglioria proposta, l'assegnatario, il revisore. NON un campo di testo
# libero: Susanna valida controllando che questi campi siano valorizzati
# (vedi is_complete/_missing_fields), non leggendo un riassunto a naso.
MANDATORY_FIELDS = [
    ('agent_config_id', 'Chi (agente di origine)'),
    ('occurred_at', 'Quando'),
    ('action_in_progress', 'Quale azione stava facendo'),
    ('problem_description', 'Il problema'),
    ('heinrich_severity', 'Valutazione Heinrich (near_miss/lieve/grave)'),
    ('outcome_if_resolved', 'Cosa crea (esito/deliverable)'),
    ('risk_if_nothing_done', 'Cosa cambia se non si fa nulla'),
    ('proposed_improvement', 'La possibile miglioria proposta'),
    ('res_model', 'Record collegato (modello)'),
    ('res_id', 'Record collegato (id)'),
]

# Soglia di routing (Compito 3): 'grave' arriva SUBITO e DIRETTAMENTE
# dall'agente di origine (mai filtrata, mai ritardata) + in copia a Susanna.
# 'near_miss'/'lieve' passano PRIMA da Susanna, che verifica la completezza
# (vedi MANDATORY_FIELDS) prima di inoltrare a Denis come richiesta pulita.
DIRECT_SEVERITIES = {'grave'}
ROUTED_SEVERITIES = {'near_miss', 'lieve'}


class Erpv6AgentCommunication(models.Model):
    """Struttura dati REALE (non testo libero) per ogni comunicazione che un
    agente vuole mandare a Denis (Compito 4, 23/08/2026) -- dettata
    esplicitamente da Denis stasera: chi, quando, quale azione, il
    problema, la valutazione (Pareto/Kairos/Heinrich, riusa il motore
    Kaizen esistente per calcolarla -- vedi erpv6_kaizen/models/
    kaizen_rule_engine.py.evaluate_12_rules, mai reinventata qui), cosa
    crea, cosa cambia se non si fa nulla, la miglioria proposta,
    l'assegnatario reale (mai implicitamente Denis) e il revisore (ruolo
    distinto dall'esecutore).

    Il routing verso Denis (Compito 3, stesso schema): route() decide da
    sola, in base a heinrich_severity, se notificare SUBITO e DIRETTAMENTE
    (grave, sempre anche in copia a Susanna) oppure se passare PRIMA da
    Susanna, che inoltra solo se la comunicazione e' completa (vedi
    _missing_fields) -- se manca qualcosa, Susanna NON inoltra: lo segnala
    come incompleto (vedi _route_via_susanna).

    Generico per costruzione (come tutta l'infrastruttura di erpv6_agent):
    qualunque agente puo' crearne una, non solo Kaizen -- vedi
    docstring di route() per l'esempio di collegamento reale gia' fatto in
    erpv6_kaizen."""
    _name = 'erpv6.agent.communication'
    _description = 'Comunicazione strutturata di un agente verso Denis (schema standard)'
    _order = 'occurred_at desc'

    name = fields.Char(string='Titolo', compute='_compute_name', store=True)

    # --- CHI / QUANDO / COSA STAVA FACENDO / IL PROBLEMA ---
    agent_config_id = fields.Many2one('erpv6.agent.config', string='Agente di Origine (chi)', required=True, ondelete='cascade')
    occurred_at = fields.Datetime(string='Quando', required=True, default=fields.Datetime.now)
    action_in_progress = fields.Text(string='Quale Azione Stava Facendo', required=True)
    problem_description = fields.Text(string='Il Problema', required=True)

    # --- VALUTAZIONE (Pareto/Kairos/Heinrich -- riusa i motori esistenti,
    # mai ricalcolati qui: questi sono SOLO collegamenti a record gia'
    # scritti da erpv6_methodology/erpv6_kaizen) ---
    pareto_analysis_id = fields.Many2one('erpv6.pareto.analysis', string='Analisi Pareto (se disponibile)')
    kairos_matrix_id = fields.Many2one('erpv6.kairos.matrix', string='Matrice Kairos (se disponibile)')
    heinrich_indicator_id = fields.Many2one('erpv6.heinrich.indicator', string='Indicatore Heinrich (se disponibile)')
    heinrich_severity = fields.Selection([
        ('near_miss', 'Near Miss'), ('lieve', 'Lieve'), ('grave', 'Grave'),
    ], string='Valutazione Heinrich', required=True, index=True,
        help="Guida il routing (vedi route()): 'grave' notifica SUBITO e DIRETTAMENTE Denis (in "
             "copia a Susanna); 'near_miss'/'lieve' passano prima da Susanna.")
    evaluation_notes = fields.Text(
        string='Motivazione della Valutazione',
        help="Breve motivazione in linguaggio semplice del perche' di questa severity' -- i numeri "
             "grezzi restano sui record Pareto/Kairos/Heinrich collegati sopra, qui solo la sintesi.")

    # --- ESITO / RISCHIO / MIGLIORIA ---
    outcome_if_resolved = fields.Text(string='Cosa Crea (esito/deliverable)', required=True)
    risk_if_nothing_done = fields.Text(string='Cosa Cambia se Non si Fa Nulla (impatto/rischio)', required=True)
    proposed_improvement = fields.Text(string='Possibile Miglioria Proposta', required=True)

    # --- ASSEGNATARIO / REVISORE (ruoli distinti, MAI implicitamente Denis
    # per l'assegnatario) -- assignee puo' essere un umano (res.users) O un
    # agente operativo (erpv6.agent.config), MAI entrambi vuoti insieme:
    # vedi _check_assignee_present sotto. reviewer resta SEMPRE res.users
    # (un revisore e' per definizione un umano che approva, in questo
    # sistema oggi sempre Denis -- coerente con tutto il resto del progetto,
    # 6 Giudici compresi, dove l'approvazione finale e' sempre umana).
    assignee_user_id = fields.Many2one('res.users', string='Assegnatario (persona reale)')
    assignee_agent_id = fields.Many2one('erpv6.agent.config', string='Assegnatario (agente operativo)')
    reviewer_user_id = fields.Many2one('res.users', string='Revisore (chi la controlla)', required=True)

    # --- RECORD COLLEGATO (thread) + ROUTING ---
    res_model = fields.Char(string='Modello Collegato', required=True)
    res_id = fields.Integer(string='ID Record Collegato', required=True)
    confirmation_id = fields.Many2one(
        'erpv6.agent.confirmation', string='Conferma Collegata', readonly=True, copy=False,
        help="Valorizzato solo se route() ha agganciato un gate di conferma (es. una decisione di "
             "fase, Compito 5) -- vuoto per una comunicazione puramente informativa.")
    routing_state = fields.Selection([
        ('draft', 'Bozza — non ancora instradata'),
        ('sent_direct', 'Inviata subito e direttamente (grave)'),
        ('sent_via_susanna', 'Inoltrata da Susanna (completa)'),
        ('incomplete', 'Bloccata da Susanna — dati mancanti'),
    ], string='Stato Instradamento', default='draft', required=True, readonly=True, copy=False)
    missing_fields_note = fields.Text(string='Campi Mancanti (se incompleta)', readonly=True, copy=False)

    @api.depends('agent_config_id', 'problem_description')
    def _compute_name(self):
        for comm in self:
            snippet = (comm.problem_description or '')[:60].replace('\n', ' ')
            comm.name = "%s: %s%s" % (
                comm.agent_config_id.name or '?', snippet, '…' if comm.problem_description and len(comm.problem_description) > 60 else '')

    @api.constrains('assignee_user_id', 'assignee_agent_id')
    def _check_assignee_present(self):
        """Vincolo non negoziabile del Compito 4: un assegnatario reale
        DEVE essere presente (persona o agente operativo) -- mai lasciato
        vuoto (che implicherebbe "nessuno", altrettanto sbagliato quanto
        far ricadere tutto implicitamente su Denis). NOTA: @api.constrains
        da solo NON basta su create() -- Odoo lo attiva solo per i campi
        davvero presenti nel dirty-set della transazione, quindi un record
        creato senza NESSUno dei due campi (mai scritti, nemmeno a False)
        potrebbe non far scattare questo controllo al create -- verificato
        dal vivo il 23/08/2026. Per questo il controllo reale e' duplicato,
        deterministico, in create()/write() sotto: questo resta come difesa
        aggiuntiva per il caso in cui un write() successivo azzeri
        esplicitamente entrambi i campi di un record gia' esistente."""
        for comm in self:
            if not comm.assignee_user_id and not comm.assignee_agent_id:
                raise UserError(_(
                    "Assegnatario mancante su '%s': serve una persona reale (assignee_user_id) o un "
                    "agente operativo (assignee_agent_id) -- mai lasciato implicito."
                ) % comm.name)

    @api.model_create_multi
    def create(self, vals_list):
        """Controllo deterministico sui vals IN INGRESSO (vedi nota sopra
        su @api.constrains): un record creato senza assignee_user_id NE'
        assignee_agent_id nei vals viene rifiutato qui, prima ancora di
        toccare il database -- non si puo' contare sul solo constrains per
        questo caso specifico."""
        for vals in vals_list:
            if not vals.get('assignee_user_id') and not vals.get('assignee_agent_id'):
                raise UserError(_(
                    "Assegnatario mancante: serve una persona reale (assignee_user_id) o un agente "
                    "operativo (assignee_agent_id) -- mai lasciato implicito, mai Denis di default."
                ))
        return super().create(vals_list)

    def _missing_fields(self):
        """Ritorna la lista (nome_campo, etichetta) dei campi dello schema
        standard non valorizzati -- usato da Susanna (_route_via_susanna)
        per decidere se inoltrare o bloccare, MAI leggendo un riassunto a
        naso: controllo diretto sui campi strutturati."""
        self.ensure_one()
        missing = []
        for fname, label in MANDATORY_FIELDS:
            if not self[fname]:
                missing.append((fname, label))
        if not self.assignee_user_id and not self.assignee_agent_id:
            missing.append(('assignee_user_id/assignee_agent_id', 'Chi la esegue (assegnatario)'))
        if not self.reviewer_user_id:
            missing.append(('reviewer_user_id', 'Chi la controlla (revisore)'))
        return missing

    def is_complete(self):
        self.ensure_one()
        return not self._missing_fields()

    def _compose_schema_facts(self):
        """Traduce TUTTI i campi dello schema standard in una lista di fatti
        in linguaggio semplice -- passata poi a notify_pending_confirmation
        (che li fa formulare in tono proprio dall'agente, senza aggiungerne
        di nuovi: stessa regola anti-allucinazione gia' applicata li')."""
        self.ensure_one()
        assignee_label = self.assignee_user_id.name if self.assignee_user_id else (
            self.assignee_agent_id.name if self.assignee_agent_id else _('NON ASSEGNATO'))
        return [
            _("Chi: %(agent)s. Quando: %(when)s.") % {'agent': self.agent_config_id.name, 'when': self.occurred_at},
            _("Azione in corso: %s") % self.action_in_progress,
            _("Problema: %s") % self.problem_description,
            _("Valutazione (Heinrich): %(sev)s.%(notes)s") % {
                'sev': self.heinrich_severity,
                'notes': (' ' + self.evaluation_notes) if self.evaluation_notes else '',
            },
            _("Se risolto, cosa crea: %s") % self.outcome_if_resolved,
            _("Se non si fa nulla: %s") % self.risk_if_nothing_done,
            _("Miglioria proposta: %s") % self.proposed_improvement,
            _("Assegnatario (chi la esegue): %s. Revisore (chi la controlla): %s.") % (
                assignee_label, self.reviewer_user_id.name),
        ]

    def route(self):
        """Punto di ingresso del routing Heinrich (Compito 3): 'grave' va
        SUBITO e DIRETTAMENTE dall'agente di origine, sempre anche in copia
        a Susanna (mai filtrata, mai ritardata) -- 'near_miss'/'lieve'
        passano PRIMA da Susanna, che verifica la completezza e inoltra
        solo se tutto lo schema e' valorizzato."""
        self.ensure_one()
        if self.routing_state != 'draft':
            _logger.info("Comunicazione #%s gia' instradata (%s), route() non ripetuto.", self.id, self.routing_state)
            return self
        if self.heinrich_severity in DIRECT_SEVERITIES:
            self._send_direct()
        else:
            self._route_via_susanna()
        return self

    def _send_direct(self):
        self.ensure_one()
        facts = self._compose_schema_facts()
        confirmation = self.agent_config_id.notify_pending_confirmation(
            title=_("[GRAVE] %s") % self.name,
            facts=facts, res_model=self.res_model, res_id=self.res_id,
        )
        self.write({'routing_state': 'sent_direct', 'confirmation_id': confirmation.id})
        # Telegram diretto dall'agente stesso (non da Susanna) per i casi
        # gravi - richiesto esplicitamente da Denis il 24/08/2026: "voglio
        # che Claudio scriva e che Susanna controlli". Susanna resta
        # comunque in copia sul thread Discuss sotto (il suo ruolo di
        # controllo/supervisione), ma l'avviso urgente parte dal canale
        # dell'agente che l'ha originato, non instradato tramite lei.
        # Best-effort: mai bloccare il resto se il bot dell'agente non e'
        # configurato/attivo (caso normale finche' Denis non fornisce un
        # token per quell'agente specifico).
        try:
            telegram_body = "%s\n\n%s" % (self.name, "\n".join(facts))
            self.env['erpv6.agent.telegram.config'].send_message_for_agent(self.agent_config_id, telegram_body)
        except Exception:
            _logger.exception(
                "Invio Telegram diretto (best-effort) fallito per comunicazione #%s -- il "
                "canale Discuss/email sopra resta comunque valido.", self.id)
        susanna = self.env['erpv6.agent.config'].search([('code', '=', 'susanna'), ('active', '=', True)], limit=1)
        if susanna and susanna.partner_id:
            record = self.env[self.res_model].browse(self.res_id)
            if record.exists() and hasattr(record, 'message_post'):
                # Copia SEMPRE, nello stesso thread, mai in un canale
                # separato -- Susanna e' "in copia", non un filtro: questo
                # post non passa da nessun gate, e' solo tracciamento.
                record.message_post(
                    body=_("(Susanna, in copia) Segnalazione GRAVE ricevuta da %s, inoltrata subito "
                           "e direttamente a Denis, nessun filtro applicato.") % self.agent_config_id.name,
                    author_id=susanna.partner_id.id,
                )

    def _route_via_susanna(self):
        self.ensure_one()
        susanna = self.env['erpv6.agent.config'].search([('code', '=', 'susanna'), ('active', '=', True)], limit=1)
        missing = self._missing_fields()
        if missing:
            missing_labels = ", ".join(label for _f, label in missing)
            self.write({'routing_state': 'incomplete', 'missing_fields_note': missing_labels})
            record = self.env[self.res_model].browse(self.res_id)
            if record.exists() and hasattr(record, 'message_post'):
                author_id = susanna.partner_id.id if susanna and susanna.partner_id else self.env.user.partner_id.id
                record.message_post(
                    body=_("(Susanna) Comunicazione di %(agent)s NON inoltrata a Denis: campi "
                           "mancanti nello schema standard -- %(missing)s. Va completata prima di "
                           "poter essere inoltrata.") % {
                        'agent': self.agent_config_id.name, 'missing': missing_labels},
                    author_id=author_id,
                )
            _logger.warning(
                "Comunicazione #%s (%s) NON inoltrata: campi mancanti %s.", self.id, self.name, missing_labels)
            return
        if not susanna:
            _logger.warning(
                "Agente Susanna non trovato/attivo -- comunicazione #%s completa ma non instradabile, "
                "resta 'draft'.", self.id)
            return
        facts = [_("Segnalazione di %s, verificata completa (tutti i campi dello schema standard "
                   "presenti), inoltrata come richiesta pulita.") % self.agent_config_id.name]
        facts += self._compose_schema_facts()
        confirmation = susanna.notify_pending_confirmation(
            title=_("[%(sev)s, via Susanna] %(title)s") % {'sev': self.heinrich_severity, 'title': self.name},
            facts=facts, res_model=self.res_model, res_id=self.res_id,
        )
        self.write({'routing_state': 'sent_via_susanna', 'confirmation_id': confirmation.id})
        # Telegram SUBITO, non solo dopo l'escalation a 5 minuti (richiesto
        # esplicitamente da Denis il 24/08/2026: "quando scrivono Susanna
        # deve scrivermi su telegram") - prima Telegram partiva solo da
        # _escalate() qui sotto, dopo il silenzio. Stesso principio
        # best-effort: un fallimento qui non deve mai bloccare il routing
        # Discuss/email gia' andato a buon fine sopra.
        try:
            telegram_body = "%s\n\n%s" % (self.name, "\n".join(facts))
            self.env['erpv6.agent.telegram.config'].send_message_for_agent(susanna, telegram_body)
        except Exception:
            _logger.exception(
                "Invio Telegram immediato (best-effort) fallito per comunicazione #%s -- il "
                "routing Discuss/email sopra resta comunque valido.", self.id)

    @api.model
    def create_and_route(self, vals):
        """Scorciatoia comune: crea la comunicazione (che valida gia' da
        sola i campi required/il vincolo assegnatario) e la instrada subito
        -- il caso d'uso normale per un agente che ha appena finito una
        valutazione."""
        comm = self.create(vals)
        comm.route()
        return comm
