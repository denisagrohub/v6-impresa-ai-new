import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6ProductionOrder(models.Model):
    _name = 'erpv6.production.order'
    _description = 'Produzione in corso (relazione, business plan, ...) collegata a un lead'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(compute='_compute_name', store=True)

    lead_id = fields.Many2one('crm.lead', string='Lead', required=True, ondelete='cascade', index=True)
    package_id = fields.Many2one(
        'erpv6.package.custom',
        string='Pacchetto',
        help='Bundle di sezioni/documento assegnato a questa produzione (deciso in fase successiva)'
    )
    phase_id = fields.Many2one('erpv6.production.phase', string='Fase Corrente', tracking=True)
    project_id = fields.Many2one(
        'project.project', string='Progetto', ondelete='set null',
        help='Creato automaticamente alla ricezione del lead (vedi _start_production)'
    )
    contract_id = fields.Many2one(
        'erpv6.contract', string='Contratto', ondelete='set null',
        help='Valorizzato solo se un consulente ha deciso manualmente di formalizzare '
             'questa produzione con NDA/contratto (action_create_contract)'
    )

    # Dati grezzi dell'intervista, non scritti su crm.lead (vedi CLAUDE.md:
    # motore vs conoscenza - non vanno confusi con x_fenice_score/x_fenice_livello,
    # che sono uno scoring diverso per la verticale Fenice).
    interview_score = fields.Integer(string='Score Intervista')
    interview_package_hint = fields.Char(
        string='Livello Intervista (grezzo)',
        help='Valore grezzo scelto nell\'intervista frontend, es. "l1"/"l2"/"l3"'
    )
    verticale = fields.Char(
        string='Verticale',
        help='Settore usato per risolvere la KB corretta (erpv6.kb.find_best_for). '
             'Dato di produzione, non scritto su crm.lead. Se vuoto, trattato come "generico".'
    )
    # Valori grezzi (stessa scelta di design di interview_package_hint: la
    # tassonomia delle opzioni vive nel frontend, non qui - un Selection
    # andrebbe fuori sync ad ogni cambio delle opzioni in intervista/page.tsx).
    # Usati da _compute_kairos_matrix() per derivare impatto/prontezza.
    interview_budget = fields.Char(string='Budget (intervista)')
    interview_tempistiche = fields.Char(string='Tempistiche (intervista)')
    interview_tipo_progetto = fields.Char(string='Tipo Progetto (intervista)')
    interview_destinatario = fields.Char(string='Destinatario BP (intervista)')
    interview_fatturato = fields.Char(string='Fatturato Azienda (intervista)')

    # "Il metodo" (erpv6.kb.engine su KB kb_type=metodo_v6, gia' usato per
    # decidere l'avanzamento fase in _evaluate_and_advance_one) - risultato
    # dell'ultima analisi, cosi' resta visibile/consultabile invece di essere
    # scartato subito dopo aver deciso se avanzare. Vuoto finche' non esiste
    # una KB metodo_v6 reale per il verticale (vedi kb_request_id sull'evento
    # corrispondente per il gap) - mai un suggerimento inventato qui.
    metodo_ultimo_suggerimento = fields.Text(string='Ultimo Suggerimento del Metodo')
    metodo_ultima_analisi_date = fields.Datetime(string='Ultima Analisi del Metodo')

    event_ids = fields.One2many('erpv6.production.event', 'order_id', string='Eventi')
    schedule_ids = fields.One2many('erpv6.production.schedule', 'order_id', string='Pianificazione Risorse')

    # Gate "procedi/pianifica/fermati" (Compito 5, 23/08/2026): quando una
    # fase e' pronta per avanzare, l'avanzamento NON e' piu' automatico --
    # si ferma qui in attesa di una decisione umana esplicita con vocabolario
    # chiuso (vedi erpv6.agent.confirmation.PHASE_DECISION_KEYWORDS/
    # request_phase_decision). phase_gate_confirmation_id resta valorizzato
    # finche' la decisione non arriva (state='pending') o e' 'fermati'/
    # 'pianifica' (nessun avanzamento, ma la conferma resta l'ultima traccia
    # della decisione presa) -- viene svuotato SOLO da _on_phase_decision
    # quando decision='procedi' ha effettivamente fatto avanzare la fase.
    phase_gate_confirmation_id = fields.Many2one(
        'erpv6.agent.confirmation', string='Decisione di Fase in Attesa', readonly=True, copy=False,
        help="Gate 'procedi/pianifica/fermati' aperto sull'avanzamento verso phase_gate_next_phase_id. "
             "Vuoto = nessuna decisione di fase in attesa in questo momento.")
    phase_gate_next_phase_id = fields.Many2one(
        'erpv6.production.phase', string='Prossima Fase (in attesa di decisione)', readonly=True, copy=False)
    phase_gate_task_id = fields.Many2one(
        'project.task', string='Task Fase (tracciabilità)', readonly=True, copy=False,
        help="UN project.task per fase attraversata (non uno per singola chiamata a metodo interna -- "
             "quelle restano nel log erpv6.production.event, gia' esistente): visibilita' in Project "
             "di quando questa fase e' stata aperta/decisa, senza moltiplicare i gate di conferma.")

    # Non un vero One2many: erpv6_library non dipende da erpv6_production
    # (e' vero il contrario), quindi niente Many2one production_order_id su
    # erpv6.library.document - riusiamo i campi polimorfici gia' esistenti
    # (source_model/source_res_id, stesso pattern di erpv6_methodology).
    document_ids = fields.Many2many(
        'erpv6.library.document', string='Documenti Prodotti',
        compute='_compute_document_ids'
    )

    def _compute_document_ids(self):
        Document = self.env['erpv6.library.document']
        for order in self:
            order.document_ids = Document.search([
                ('source_model', '=', 'erpv6.production.order'),
                ('source_res_id', '=', order.id),
            ])

    @api.depends('lead_id', 'phase_id')
    def _compute_name(self):
        for order in self:
            phase_name = order.phase_id.name or 'senza fase'
            order.name = f"{order.lead_id.name or '?'} - {phase_name}"

    def advance_phase(self, new_phase_id, event_vals=None):
        """Fase 1: solo scrittura fase + log evento, nessuna logica di decisione.
        La logica reale (regole deterministiche, erpv6.kb.engine, fallback AI,
        6 Giudici) arriva in Fase 2/3."""
        self.ensure_one()
        vals = dict(event_vals or {})
        vals.update({
            'order_id': self.id,
            'phase_before_id': self.phase_id.id,
            'phase_after_id': new_phase_id,
        })
        self.env['erpv6.production.event'].create(vals)
        self.phase_id = new_phase_id
        new_phase = self.env['erpv6.production.phase'].browse(new_phase_id)
        self.env['erpv6.production.schedule'].sudo().create_for_phase(self, new_phase)
        return True

    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        for order in orders:
            if not order.phase_id:
                continue
            try:
                self.env['erpv6.production.schedule'].sudo().create_for_phase(order, order.phase_id)
            except Exception:
                # Fuori dal savepoint di evaluate_and_advance: questo path e'
                # chiamato in diretta da erpv6_api_gateway su ogni lead reale
                # in ingresso - un errore di pianificazione non deve mai far
                # fallire l'intake di un lead.
                _logger.exception(
                    "create_for_phase fallito alla creazione di produzione #%s, intake non impattato.", order.id
                )
        return orders

    def _build_typst_data(self):
        """Dati reali disponibili sull'ordine, usati sia per generare il
        documento typst sia come context_data della validation.session.
        Nessun dato inventato: solo campi che esistono davvero."""
        self.ensure_one()
        return {
            'lead_name': self.lead_id.name or '',
            'email_from': self.lead_id.email_from or '',
            'interview_score': self.interview_score,
            'interview_package_hint': self.interview_package_hint or '',
            'verticale': self.verticale or '',
        }

    def _compute_kairos_matrix(self):
        """Crea/aggiorna una erpv6.kairos.matrix (matrix_type='finanziario',
        motore generico di erpv6_methodology, non reimplementato qui) per
        capire se vale la pena chiamare subito questo lead o nutrirlo prima.
        Richiede budget+tempistiche dall'intervista: se mancano (es. lead da
        form contatti, non dall'intervista) non crea nulla - mai una matrice
        fabbricata su dati che non ci sono.

        Il mapping risposta intervista -> punteggio (budget/tempistiche
        hanno un segnale diretto nell'intervista attuale; gli altri 3
        indicatori restano al valore neutro, deciso esplicitamente con
        l'utente, mai inventato un segnale che l'intervista non raccoglie
        davvero) vive in erpv6.kairos.scoring.rule, non piu' in dizionari
        Python qui -- corretto il 23/08/2026 (audit "motore vs conoscenza"):
        sono regole di business reali, un admin deve poterle correggere
        senza un promote del modulo. Le chiavi letterali (le stringhe
        opzione) restano invece accoppiate ad apps/impresa/src/app/intervista/page.tsx,
        vincolo tecnico reale, non spostato."""
        self.ensure_one()
        budget = (self.interview_budget or '').strip()
        tempistiche = (self.interview_tempistiche or '').strip()
        if not budget or not tempistiche:
            return False

        Scoring = self.env['erpv6.kairos.scoring.rule']
        impatto = Scoring.get_score('budget_impatto', budget)
        liquidita = Scoring.get_score('budget_liquidita', budget)
        urgenza = Scoring.get_score('tempistiche_urgenza', tempistiche)
        if impatto is None or urgenza is None:
            _logger.warning(
                "Kairos: budget '%s' o tempistiche '%s' non riconosciuti (opzioni intervista cambiate, "
                "o erpv6.kairos.scoring.rule non ancora configurata per questa opzione?) "
                "per produzione #%s - matrice non calcolata.", budget, tempistiche, self.id,
            )
            return False
        neutro = Scoring.get_neutro_score()

        Matrix = self.env['erpv6.kairos.matrix'].sudo()
        vals = {
            'res_model': self._name,
            'res_id': self.id,
            'matrix_type': 'finanziario',
            'impatto_score': impatto,
            'indicatore_1': neutro,
            'indicatore_2': liquidita if liquidita is not None else neutro,
            'indicatore_3': neutro,
            'indicatore_4': urgenza,
            'indicatore_5': neutro,
            'notes': (
                "Calcolato automaticamente da budget/tempistiche dell'intervista "
                "(_compute_kairos_matrix). Indicatori 1/3/5 = valore neutro: "
                "l'intervista non raccoglie apertura del titolare o storico bancario."
            ),
        }
        existing = Matrix.search([
            ('res_model', '=', self._name), ('res_id', '=', self.id), ('matrix_type', '=', 'finanziario'),
        ], limit=1)
        if existing:
            existing.write(vals)
            return existing
        return Matrix.create(vals)

    def _notify_stall(self, summary, note=None):
        """Crea un'activity Odoo (visibile in Attivita'/Discuss, non solo
        nel log eventi dell'ordine) quando la produzione resta bloccata o
        va in errore - cosi' un admin/consulente lo vede anche senza aprire
        l'ordine. Non duplica se esiste gia' un'activity aperta identica,
        per non spammare ad ogni tick del cron (ogni 30 min).

        'summary' e' la CHIAVE di deduplicazione: deve restare stabile tra
        un tentativo e l'altro dello stesso blocco (mai un id di record
        creato ad ogni retry, es. typst_doc.id, altrimenti il confronto
        sotto non trova mai il duplicato -- bug reale trovato il 21/08/2026,
        191 activity duplicate su 3 produzioni in 32 ore per questo motivo).
        Il dettaglio variabile (es. id dell'ultimo documento fallito) va in
        'note', che viene aggiornata sull'activity esistente invece di
        crearne una nuova, cosi' il to-do resta informativo senza spammare."""
        self.ensure_one()
        activity_type = self.env.ref('mail.mail_activity_data_todo', raise_if_not_found=False)
        if not activity_type:
            return
        note = note or summary
        existing = self.env['mail.activity'].search([
            ('res_model', '=', self._name),
            ('res_id', '=', self.id),
            ('activity_type_id', '=', activity_type.id),
            ('summary', '=', summary),
        ], limit=1)
        if existing:
            existing.write({'note': note})
            return
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=summary,
            note=note,
            user_id=self.lead_id.user_id.id or self.env.user.id,
        )

    def _generate_phase_output(self, phase):
        """Fase 2: genera il documento per una fase requires_output=True,
        SOLO se la fase ha un typst_template_id configurato. Se non ce l'ha
        (es. nessun template .typ esiste ancora per quella fase), non genera
        nulla: l'avanzamento resta bloccato finche' un documento non viene
        caricato manualmente in erpv6_library con lo stesso source_model/
        source_res_id - mai un fallback con contenuto inventato."""
        self.ensure_one()
        if not phase.typst_template_id:
            _logger.info(
                "Fase '%s' richiede output ma non ha typst_template_id: "
                "produzione #%s resta in attesa di un documento caricato manualmente.",
                phase.name, self.id,
            )
            self.env['erpv6.production.event'].create({
                'order_id': self.id,
                'event_type': 'cron_automatico',
                'decision_method': 'deterministico',
                'description': (
                    f"Fase '{phase.name}' richiede output ma non ha un template Typst configurato — "
                    "avanzamento sospeso in attesa di configurazione o di un documento caricato manualmente."
                ),
                'phase_before_id': phase.id,
            })
            self._notify_stall(
                _("Produzione ferma: manca il modello del documento («fase %s») — %s")
                % (phase.name, self.name),
                note=_(
                    "La produzione «%(order)s» è ferma alla fase «%(phase)s» perché "
                    "nessuno ha ancora caricato/impostato il modello del documento da generare in "
                    "questa fase. Serve un intervento umano: o si configura il modello mancante, "
                    "o si carica il documento a mano per questa produzione."
                ) % {'order': self.name, 'phase': phase.name},
            )
            return False

        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            phase.typst_template_id.id,
            'erpv6.production.order',
            self.id,
            data=self._build_typst_data(),
        )
        # action_render() (chiamato dentro generate_document) non solleva mai
        # un'eccezione al chiamante - cattura tutto e scrive status='failed'
        # + error_message sul documento. Se non controlliamo lo status qui,
        # register_document() viene chiamato comunque e l'evento sotto dice
        # "generato con successo" anche quando il rendering e' fallito per
        # davvero (es. template senza typst_source) - falso successo scoperto
        # in audit, non piu' silenzioso.
        if typst_doc.status != 'ready':
            self.env['erpv6.production.event'].create({
                'order_id': self.id,
                'event_type': 'cron_automatico',
                'decision_method': 'deterministico',
                'description': (
                    f"Generazione documento fallita per fase '{phase.name}' (typst doc #{typst_doc.id}, "
                    f"status='{typst_doc.status}'): {typst_doc.error_message or 'nessun dettaglio'} — "
                    "avanzamento sospeso."
                ),
                'phase_before_id': phase.id,
            })
            self._notify_stall(
                _("Produzione ferma: il documento non si genera («fase %s») — %s")
                % (phase.name, self.name),
                note=_(
                    "La produzione «%(order)s» è ferma alla fase «%(phase)s»: il documento non "
                    "si riesce a generare. Motivo: %(error)s. Serve un intervento umano per "
                    "risolvere il motivo indicato (riferimento interno: documento Typst #%(doc)s)."
                ) % {
                    'order': self.name, 'phase': phase.name,
                    'error': typst_doc.error_message or _("nessun dettaglio disponibile"),
                    'doc': typst_doc.id,
                },
            )
            return False

        library_doc = self.env['erpv6.library.document'].register_document(
            project_id=self.lead_id.id,
            name=f"{phase.name} - {self.lead_id.name or self.name}",
            category=phase.output_category,
            origin='generated',
            source_model='erpv6.production.order',
            source_res_id=self.id,
            is_final=(phase.output_category == 'final'),
        )

        # Ogni documento generato riceve un lotto (tracciabilita', vedi
        # CLAUDE.md/regola pipeline documenti) - non blocca l'avanzamento se
        # la config manca (es. admin l'ha disattivata), ma lo segnala.
        lot = False
        try:
            lot = library_doc.action_create_batch_lot(config_code='document')
        except Exception:
            _logger.exception(
                "Assegnazione lotto fallita per documento #%s (produzione #%s), non bloccante.",
                library_doc.id, self.id,
            )

        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'documento_generato',
            'decision_method': 'deterministico',
            'description': (
                f"Documento generato per fase '{phase.name}' (typst doc #{typst_doc.id}, "
                f"lotto {lot.code if lot else 'non assegnato'})"
            ),
            'phase_before_id': phase.id,
            'phase_after_id': phase.id,
        })
        return library_doc

    def _create_validation_session(self, phase, trigger='cron'):
        """Avvia una sessione 6 Giudici sull'output della fase corrente.
        L'avanzamento fase resta sospeso fino a un action_human_approve()
        (vedi models/validation_session.py) - mai auto-applicato, per il
        principio CLAUDE.md su output CCP/fiscalita'-sensibili."""
        self.ensure_one()
        session = self.env['erpv6.validation.session'].create({
            'res_model': 'erpv6.production.order',
            'res_id': self.id,
            'destinatario': self.lead_id.name or 'Cliente',
            'scopo': f"Validazione output fase '{phase.name}'",
            'context_data': self._build_typst_data(),
            'validation_mode': phase.validation_mode or 'full_six_judges',
        })
        session.action_start_validation()
        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'cron_automatico' if trigger == 'cron' else 'interazione_consulente',
            'decision_method': 'ai',
            'validation_session_id': session.id,
            'description': f"Validazione avviata per fase '{phase.name}'",
            'phase_before_id': phase.id,
        })
        return session

    def evaluate_and_advance(self, trigger='cron', event_vals=None):
        """Punto di ingresso della logica reale di avanzamento (Fase 2).
        advance_phase() resta l'unico scrittore finale della fase; questo
        metodo decide SE e QUANDO chiamarlo, cablando erpv6_typst (output),
        erpv6_validation (6 Giudici) ed erpv6_kb (conoscenza di verticale)
        - mai regole di settore hardcoded qui (motore vs conoscenza)."""
        event_type = 'cron_automatico' if trigger == 'cron' else 'interazione_consulente'

        for order in self:
            try:
                with self.env.cr.savepoint():
                    order._evaluate_and_advance_one(event_type, trigger, event_vals)
            except Exception:
                # Isolamento per-ordine: un'eccezione su un ordine (es. binario
                # typst assente, errore rete AI) non deve far fallire l'intero
                # batch del cron ne' - se trigger='validation_approved' - far
                # sparire in rollback l'approvazione umana appena data.
                _logger.exception(
                    "evaluate_and_advance fallito per produzione #%s, ordine isolato.", order.id
                )
                self.env['erpv6.production.event'].create({
                    'order_id': order.id,
                    'event_type': event_type,
                    'decision_method': 'deterministico',
                    'description': "Errore durante la valutazione di avanzamento — vedi log server. Ordine isolato, gli altri non sono stati impattati.",
                    'phase_before_id': order.phase_id.id,
                })
                order._notify_stall(
                    _("Produzione ferma per un errore tecnico — %s") % order.name,
                    note=_(
                        "La produzione «%s» si è fermata per un errore tecnico imprevisto durante "
                        "l'avanzamento automatico. Serve un intervento tecnico per capire la causa "
                        "(dettaglio nel log del server)."
                    ) % order.name,
                )

        return True

    def _evaluate_and_advance_one(self, event_type, trigger, event_vals):
        self.ensure_one()
        order = self
        phase = order.phase_id
        if not phase:
            return

        next_phase = self.env['erpv6.production.phase'].search(
            [('sequence', '>', phase.sequence), ('active', '=', True)],
            order='sequence asc', limit=1,
        )
        if not next_phase:
            return

        document_generated = None
        if phase.requires_output:
            existing_doc = order.document_ids.filtered(lambda d: d.category == phase.output_category)
            if not existing_doc:
                generated = order._generate_phase_output(phase)
                if not generated:
                    return
                document_generated = generated

        if phase.requires_validation:
            last_session = self.env['erpv6.validation.session'].search(
                [('res_model', '=', 'erpv6.production.order'), ('res_id', '=', order.id)],
                order='create_date desc', limit=1,
            )
            if not last_session or last_session.status == 'rejected':
                order._create_validation_session(phase, trigger=trigger)
                return
            if last_session.status == 'escalated_to_human':
                order._notify_stall(
                    _("Produzione ferma: serve la tua approvazione («fase %s») — %s")
                    % (phase.name, order.name),
                    note=_(
                        "La produzione «%(order)s» è ferma alla fase «%(phase)s»: la validazione "
                        "automatica non ha raggiunto un accordo e serve una decisione umana. Vai alla "
                        "sessione di validazione e scegli se approvare o rifiutare."
                    ) % {'order': order.name, 'phase': phase.name},
                )
                return
            if last_session.status != 'approved':
                return

        kb_id = self.env['erpv6.kb'].find_best_for(kb_type='metodo_v6', verticale=order.verticale or None)
        if not kb_id:
            self.env['erpv6.production.event'].create({
                'order_id': order.id,
                'event_type': event_type,
                'decision_method': 'ai',
                'description': f"Nessuna KB risolvibile per verticale '{order.verticale or 'generico'}' — avanzamento sospeso.",
                'phase_before_id': phase.id,
            })
            order._notify_stall(
                _("Produzione ferma: manca conoscenza per il settore «%s» — %s")
                % (order.verticale or _('generico'), order.name),
                note=_(
                    "La produzione «%(order)s» è ferma: non è stata trovata nessuna voce della "
                    "Knowledge Base adatta al settore «%(verticale)s» per continuare. Serve creare/"
                    "approvare una voce KB adatta a questo settore."
                ) % {'order': order.name, 'verticale': order.verticale or _('generico')},
            )
            return

        result = self.env['erpv6.kb.engine'].process(kb_id, {
            'sector': order.verticale or '',
            'order_id': order.id,
            'phase': phase.name,
        })
        if isinstance(result, dict) and (result.get('fallback') or result.get('kb_request_id')):
            kb_request_id = result.get('kb_request_id')
            self.env['erpv6.production.event'].create({
                'order_id': order.id,
                'event_type': event_type,
                'decision_method': 'ai',
                'kb_request_id': kb_request_id,
                'description': (
                    f"In attesa risoluzione KB admin (kb.request #{kb_request_id})"
                    if kb_request_id else "KB troppo generica, in attesa di risoluzione."
                ),
                'phase_before_id': phase.id,
            })
            return

        # Cattura il risultato del metodo (prima veniva scartato subito dopo
        # aver deciso se avanzare) cosi' resta consultabile da consulente/UI,
        # non solo usato una tantum per la decisione binaria fallback si'/no.
        order.write({
            'metodo_ultimo_suggerimento': str(result),
            'metodo_ultima_analisi_date': fields.Datetime.now(),
        })

        # Gate "procedi/pianifica/fermati" (Compito 5, 23/08/2026): il
        # risultato e' pronto (output generato, validazione approvata se
        # richiesta, il metodo ha risposto) -- ma NON avanza piu' da solo.
        # Se un gate e' gia' aperto per QUESTA stessa transizione, non ne
        # apre un secondo (evita spam ad ogni giro del cron): resta in
        # attesa, o -- se la decisione presa e' 'fermati' -- resta fermo
        # finche' un umano non lo riapre esplicitamente (nessun campo di
        # "riprova" automatico, per design: 'fermati' e' una scelta, non
        # un errore tecnico da ritentare).
        existing_gate = order.phase_gate_confirmation_id
        if existing_gate and order.phase_gate_next_phase_id.id == next_phase.id:
            if existing_gate.state == 'pending':
                return
            if existing_gate.decision_result == 'fermati':
                return
            # 'pianifica' senza ancora un nuovo esito: riapre lo stesso gate
            # (stesso schema di "not existing_gate" sotto, non duplicato).
        order._open_phase_gate(phase, next_phase)
        return

    def _open_phase_gate(self, phase, next_phase):
        """Apre il gate 'procedi/pianifica/fermati' (Compito 5) per la
        transizione phase -> next_phase: un project.task per tracciabilita'
        (vedi phase_gate_task_id, UNA per fase, non per singolo step interno)
        + una erpv6.agent.confirmation con decision_type='phase_decision'
        (vedi erpv6.agent.confirmation.request_phase_decision). L'azione
        'procedi' agganciata e' _do_advance_after_gate (no-arg, legge
        phase_gate_next_phase_id/advance_event_vals gia' salvati sull'ordine
        -- il meccanismo di conferma chiama sempre un metodo senza
        argomenti, mai con parametri custom)."""
        self.ensure_one()
        project = self.project_id
        task_name = _("Fase: %(from)s → %(to)s — decisione richiesta") % {
            'from': phase.name, 'to': next_phase.name}
        task = False
        if project:
            task = self.env['project.task'].sudo().create({
                'name': task_name,
                'project_id': project.id,
                'description': _(
                    "Il risultato della fase «%(from)s» è pronto (output/validazione già superati). "
                    "In attesa di una decisione esplicita su «%(order)s»: procedi, pianifica o fermati."
                ) % {'from': phase.name, 'order': self.name},
            })
        # advance_event_vals (il dict passato da _evaluate_and_advance_one)
        # non viene salvato su nessun campo: e' un dettaglio del giro cron
        # che lo ha proposto, mai un dato Python complesso persistito su un
        # record Odoo. Al momento di 'procedi' (_do_advance_after_gate)
        # viene ricostruito con gli stessi valori di default -- l'unica
        # informazione che deve sopravvivere fino ad allora e' QUALE fase,
        # gia' persistita sotto in phase_gate_next_phase_id.
        self.write({
            'phase_gate_next_phase_id': next_phase.id,
            'phase_gate_task_id': task.id if task else False,
        })

        AgentConfig = self.env['erpv6.agent.config']
        andrea = AgentConfig.search([('code', '=', 'andrea'), ('active', '=', True)], limit=1)
        susanna = AgentConfig.search([('code', '=', 'susanna'), ('active', '=', True)], limit=1)
        # Andrea (dominio Typst/template/produzione) se attivo, altrimenti
        # Susanna (coordinatore, sempre presente) -- mai bloccare l'intero
        # gate solo perche' un agente specifico non e' configurato.
        speaking_agent = andrea or susanna
        if not speaking_agent:
            _logger.warning(
                "Nessun agente attivo (andrea/susanna) per aprire il gate di fase su produzione #%s -- "
                "avanzamento sospeso SENZA notifica strutturata (solo log).", self.id)
            return False

        facts = [
            _("Fase attuale: «%(from)s». Prossima fase proposta: «%(to)s».") % {
                'from': phase.name, 'to': next_phase.name},
            _("Il risultato di questa fase è pronto: output generato (se richiesto) e validazione "
              "6 Giudici approvata (se richiesta) — questo NON è un blocco tecnico, è il normale "
              "punto di decisione dopo un risultato pronto."),
            _("Rispondi in QUESTO thread con UNA di queste parole chiave (nessun'altra formulazione "
              "viene riconosciuta): 'procedi' o 'ok' per avanzare subito alla fase successiva; "
              "'pianifica' per non avanzare ora ma tenerlo aperto per una decisione successiva; "
              "'fermati' o 'stop' per bloccare esplicitamente l'avanzamento."),
        ]
        confirmation = self.env['erpv6.agent.confirmation'].request_phase_decision(
            agent_config=speaking_agent,
            title=_("Produzione «%(order)s»: fase «%(phase)s» pronta — procedi, pianifica o fermati?") % {
                'order': self.name, 'phase': phase.name},
            facts=facts,
            res_model=self._name, res_id=self.id,
            action_model=self._name, action_res_id=self.id, action_method='_do_advance_after_gate',
        )
        self.phase_gate_confirmation_id = confirmation.id
        return confirmation

    def _do_advance_after_gate(self):
        """Azione 'procedi' agganciata al gate (vedi _open_phase_gate) --
        no-arg per costruzione (erpv6.agent.confirmation puo' chiamare solo
        metodi senza argomenti): legge phase_gate_next_phase_id gia' salvato
        sull'ordine, chiama advance_phase() (l'unico scrittore finale della
        fase, invariato) e chiude il task di tracciabilita'."""
        self.ensure_one()
        next_phase = self.phase_gate_next_phase_id
        if not next_phase:
            raise UserError(_("Nessuna fase in attesa di decisione su questa produzione."))
        vals = {
            'event_type': 'interazione_consulente',
            'decision_method': 'deterministico',
            'description': _("Avanzamento confermato dalla decisione 'procedi' sul gate di fase."),
        }
        self.advance_phase(next_phase.id, event_vals=vals)
        if self.phase_gate_task_id:
            self.phase_gate_task_id.sudo().write({'state': '1_done'})
        self._notify_consultant_update(next_phase)

    def _on_phase_decision(self, decision, confirmation):
        """Hook chiamato genericamente da erpv6.agent.confirmation._do_phase_decision
        dopo OGNI esito (procedi/pianifica/fermati) -- qui puliamo/aggiorniamo
        i campi propri di produzione (agent_confirmation non li conosce, e'
        generico per costruzione). Per 'procedi' l'avanzamento vero e'
        gia' avvenuto (_do_advance_after_gate, chiamato PRIMA di questo hook
        dal meccanismo di conferma): qui restano solo da svuotare i campi di
        gate. Per 'pianifica'/'fermati' i campi di gate restano valorizzati
        apposta (nessun avanzamento, il gate resta "l'ultima decisione
        nota" finche' non arriva un 'procedi')."""
        self.ensure_one()
        if decision == 'procedi':
            self.write({'phase_gate_confirmation_id': False, 'phase_gate_next_phase_id': False})

    def _notify_consultant_update(self, new_phase, document_generated=None):
        """Aggiorna il consulente (venditore assegnato sul lead) ogni volta
        che il metodo fa avanzare davvero una fase - non solo sul log eventi
        interno, che nessuno controlla proattivamente. Se in questo stesso
        giro e' stato generato anche un documento, lo segnala col suo lotto."""
        self.ensure_one()
        user = self.lead_id.user_id
        if not user or user == self.env.ref('base.public_user', raise_if_not_found=False):
            return
        summary = f"Produzione #{self.id} ({self.lead_id.name}) avanzata a '{new_phase.name}'"
        note_parts = []
        if document_generated:
            lot_code = document_generated.batch_lot_id.code if document_generated.batch_lot_id else 'non assegnato'
            note_parts.append(f"Documento generato: '{document_generated.name}' (lotto {lot_code}).")
        if self.metodo_ultimo_suggerimento:
            note_parts.append(f"Suggerimento del metodo: {self.metodo_ultimo_suggerimento}")
        self.lead_id.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=summary,
            note='\n'.join(note_parts) or summary,
            user_id=user.id,
        )

    def action_consultant_advance(self):
        self.ensure_one()
        return self.evaluate_and_advance(trigger='consultant')

    def action_create_contract(self):
        """Escalation manuale: il consulente, dopo aver visto il report,
        decide di formalizzare questa produzione con NDA/contratto invece di
        proseguire sul percorso standard a pacchetto. Mai automatico: e'
        una scelta umana (vedi discussione con l'utente su acquisizione vs
        vendita standard L1/L2)."""
        self.ensure_one()
        if self.contract_id:
            raise UserError(_("Questa produzione ha gia' un contratto collegato (#%s).") % self.contract_id.id)

        self.lead_id.sudo()._handle_partner_assignment(create_missing=True)
        partner = self.lead_id.partner_id
        if not partner:
            raise UserError(_("Impossibile determinare un cliente per questo lead - contatto non risolvibile."))

        contract = self.env['erpv6.contract'].sudo().create({
            'name': f"Contratto - {self.name}",
            'partner_id': partner.id,
            'project_id': self.project_id.id if self.project_id else False,
        })
        self.contract_id = contract.id
        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'interazione_consulente',
            'decision_method': 'deterministico',
            'description': f"Contratto #{contract.id} creato manualmente da {self.env.user.name}.",
            'phase_before_id': self.phase_id.id,
            'phase_after_id': self.phase_id.id,
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.contract',
            'res_id': contract.id,
            'view_mode': 'form',
            'target': 'current',
        }

    @api.model
    def _cron_evaluate_all(self):
        phases = self.env['erpv6.production.phase'].search([('active', '=', True)])
        if not phases:
            return
        max_sequence = max(phases.mapped('sequence'))
        orders = self.search([('phase_id', '!=', False)]).filtered(
            lambda o: o.phase_id.sequence < max_sequence
        )
        if orders:
            orders.evaluate_and_advance(trigger='cron')
