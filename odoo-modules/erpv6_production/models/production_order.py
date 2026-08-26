import base64
import hashlib
import json
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
             'questa produzione con NDA/contratto (action_create_contract), oppure '
             'automaticamente dai gate richiede_nda/richiede_contratto (vedi prodotto_id).'
    )
    prodotto_id = fields.Many2one(
        'erpv6.prodotto.consulenza', string='Prodotto Consulenza', tracking=True,
        help="Se valorizzato, la sequenza di fasi di QUESTA produzione segue l'ordine scelto dentro "
             "questo prodotto (non piu' il catalogo globale) e i flag NDA/contratto/pagamento delle sue "
             "fasi si applicano agli avanzamenti (vedi _next_phase_for/_do_advance_after_gate). Vuoto = "
             "comportamento invariato (catalogo globale, nessun gate NDA/contratto/pagamento aggiuntivo) "
             "- produzioni esistenti prima di questo compito non sono impattate."
    )
    tranche_ids = fields.One2many(
        'erpv6.production.order.tranche', 'order_id', string='Tranche di Pagamento')

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

    # Due nuovi "metodi" (Compito Denis, notte 24-25/08/2026): "analisi
    # win-win" e "profilo DISC" - stesso pattern KB+AI di sopra (kb_type
    # 'metodo_v6', vedi data/kb_metodo_winwin_disc_data.xml), non un motore
    # nuovo. Il risultato completo vive nel erpv6.library.document generato
    # (gia' visibile in document_ids sopra); questi campi sono solo un
    # riferimento rapido in scheda, come metodo_ultima_analisi_date sopra.
    winwin_ultima_analisi_date = fields.Datetime(string='Ultima Analisi Win-Win', readonly=True, copy=False)
    disc_ultima_analisi_date = fields.Datetime(string='Ultima Analisi DISC', readonly=True, copy=False)
    disc_profilo_dominante = fields.Char(
        string='Profilo DISC Rilevato', readonly=True, copy=False,
        help="Ultima lettera/combinazione DISC dominante rilevata dal metodo, solo per consultazione "
             "rapida - il dettaglio completo (indizi, confidenza, implicazioni comunicative) vive nel "
             "documento generato (vedi document_ids).")

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

    def _next_phase_for(self, phase):
        """Prossima fase dopo 'phase' (Compito "wizard-prodotto-consulenza",
        25/08/2026 - prima un prodotto non era un concetto esplicito: tutte
        le produzioni condividevano UNA sola sequenza globale nel catalogo
        erpv6.production.phase).

        Se questo ordine ha un prodotto configurato (prodotto_id), la
        sequenza vive DENTRO le fasi scelte per quel prodotto
        (erpv6.prodotto.consulenza.fase.sequence), non nel catalogo
        condiviso: due prodotti diversi possono riusare le stesse fasi di
        catalogo in ordini diversi senza interferire tra loro.

        Senza prodotto_id (produzioni create prima di questo compito, o
        genuinamente generiche): stessa ricerca globale di sempre, MA
        esclude le fasi ormai "di proprieta'" di un qualunque prodotto
        configurato - altrimenti, appena questo compito aggiunge nuove
        righe al catalogo condiviso per il Business Plan (sequence 40-90,
        dopo Consegnato=30), una produzione generica gia' ferma su
        'Consegnato' le vedrebbe come prossima fase e ci avanzerebbe per
        errore. Una fase referenziata da un prodotto e' raggiungibile SOLO
        attraverso quel prodotto, mai piu' dalla catena anonima."""
        self.ensure_one()
        if self.prodotto_id:
            fase_lines = self.prodotto_id.fase_ids.sorted('sequence')
            current_line = fase_lines.filtered(lambda f: f.phase_id.id == phase.id)
            if not current_line:
                return self.env['erpv6.production.phase']
            idx = fase_lines.ids.index(current_line[:1].id)
            remaining = fase_lines[idx + 1:]
            return remaining[:1].phase_id if remaining else self.env['erpv6.production.phase']

        used_phase_ids = self.env['erpv6.prodotto.consulenza.fase'].sudo().search([]).mapped('phase_id').ids
        domain = [('sequence', '>', phase.sequence), ('active', '=', True)]
        if used_phase_ids:
            domain.append(('id', 'not in', used_phase_ids))
        return self.env['erpv6.production.phase'].search(domain, order='sequence asc', limit=1)

    def _evaluate_and_advance_one(self, event_type, trigger, event_vals):
        self.ensure_one()
        order = self
        phase = order.phase_id
        if not phase:
            return

        next_phase = order._next_phase_for(phase)
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

    def _get_fase_config(self, phase):
        """Riga di configurazione (flag NDA/contratto/pagamento) di 'phase'
        DENTRO il prodotto consulenza collegato a questo ordine
        (prodotto_id), se esiste. Un ordine senza prodotto_id (produzioni
        esistenti prima di questo compito, o generiche) non ha nessun gate
        aggiuntivo: record vuoto, comportamento identico a prima."""
        self.ensure_one()
        if not self.prodotto_id or not phase:
            return self.env['erpv6.prodotto.consulenza.fase']
        return self.prodotto_id.fase_ids.filtered(lambda f: f.phase_id.id == phase.id)[:1]

    def _ensure_tranches_for(self, fase_config):
        """Crea (idempotente) le righe erpv6.production.order.tranche per
        QUESTA produzione sulla fase configurata fase_config - 1 riga se
        pagamento_tipo='unico', numero_tranche righe se 'tranche'. Se le
        tranche esistono gia' (secondo giro sulla stessa fase), le ritorna
        senza duplicare."""
        self.ensure_one()
        existing = self.tranche_ids.filtered(lambda t: t.fase_config_id.id == fase_config.id)
        if existing:
            return existing
        Tranche = self.env['erpv6.production.order.tranche'].sudo()
        count = 1 if fase_config.pagamento_tipo == 'unico' else max(fase_config.numero_tranche, 1)
        vals_list = []
        for n in range(1, count + 1):
            importo = fase_config.importo_pagamento_unico if fase_config.pagamento_tipo == 'unico' else 0.0
            vals_list.append({
                'order_id': self.id,
                'fase_config_id': fase_config.id,
                'tranche_number': n,
                'importo': importo,
                'currency_id': fase_config.currency_id.id,
            })
        return Tranche.create(vals_list)

    def _create_contract_record(self):
        """Crea davvero il contratto per questa produzione (risoluzione
        partner + creazione erpv6.contract) - estratto da action_create_contract
        cosi' i gate automatici sotto (_ensure_contract) possono riusare la
        STESSA logica invece di duplicarla, senza pero' ereditare il
        controllo "gia' esistente -> errore" che ha senso solo per l'azione
        manuale esplicita."""
        self.ensure_one()
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
        return contract

    def _ensure_contract(self):
        """Ritorna il contratto di questa produzione, creandolo se manca
        ancora - riusato sia dall'azione manuale (action_create_contract,
        che blocca se esiste gia') sia dai gate automatici NDA/contratto
        sotto, che devono invece essere idempotenti: 'un NDA/contratto
        unico per cliente/progetto', mai uno nuovo ad ogni fase che lo
        richiede."""
        self.ensure_one()
        if self.contract_id:
            return self.contract_id
        return self._create_contract_record()

    def _build_contract_doc_data(self, doc_type):
        """Dati REALI per generare il PDF di un erpv6.contract.document
        (Compito "wizard-prodotto-consulenza", parte 2 - 25/08/2026): solo
        campi che esistono davvero su questo ordine/contratto/prodotto,
        mai un valore inventato (regola anti-allucinazione) - ogni chiave
        e' aggiunta SOLO se il dato sorgente e' presente, i template .typ
        sono scritti per gestire in modo esplicito l'assenza di una chiave
        (#if "chiave" in data), mai un placeholder finto al suo posto."""
        self.ensure_one()
        contract = self.contract_id
        partner = (contract.partner_id if contract else False) or self.lead_id.partner_id
        prodotto = self.prodotto_id

        data = {
            'doc_type': doc_type,
            'generated_at': fields.Date.context_today(self).strftime('%d/%m/%Y'),
            'azienda_fornitore': self.env.company.name,
            'progetto_nome': self.lead_id.name or self.name,
        }
        cliente_nome = (partner.name if partner else False) or self.lead_id.partner_name or self.lead_id.contact_name
        if cliente_nome:
            data['cliente_nome'] = cliente_nome
        if partner and partner.vat:
            data['cliente_piva'] = partner.vat
        if partner and (partner.street or partner.city):
            data['cliente_indirizzo'] = ", ".join(filter(None, [partner.street, partner.city]))

        if prodotto:
            data['prodotto_nome'] = prodotto.product_id.name or prodotto.name
            if prodotto.product_id.list_price:
                data['importo_totale'] = prodotto.product_id.list_price
            payment_fase = prodotto.fase_ids.filtered(lambda f: f.richiede_pagamento)[:1]
            if payment_fase:
                data['pagamento_tipo'] = payment_fase.pagamento_tipo
                if payment_fase.pagamento_tipo == 'tranche':
                    data['numero_tranche'] = payment_fase.numero_tranche
                elif payment_fase.importo_pagamento_unico:
                    data['importo_unico'] = payment_fase.importo_pagamento_unico

        if self.tranche_ids:
            data['tranche'] = [
                {'numero': t.tranche_number, 'importo': t.importo, 'stato': t.stato}
                for t in self.tranche_ids
            ]
        return data

    def _generate_contract_document_pdf(self, contract_doc, template_xmlid):
        """Genera per davvero il PDF di un erpv6.contract.document (NDA/
        Contratto/Promessa di Pagamento), riusando il motore Typst gia'
        esistente - stesso pattern di _generate_phase_output sopra:
        template -> erpv6.typst.engine.generate_document ->
        erpv6.typst.document.pdf_file - poi copia il PDF risultante sul
        record contract_doc stesso (content/file_name/hash), che e' dove
        erpv6_contract si aspetta di trovarlo (non un erpv6.library.document
        separato: erpv6.contract.document ha gia' il proprio schema di
        storage file).

        Un rendering fallito (template senza typst_source ancora
        configurato, binario typst non disponibile, dati insufficienti) NON
        blocca la creazione del documento contrattuale ne' l'avanzamento di
        fase: logga e lascia il documento senza PDF - stesso trattamento
        del caso equivalente in _generate_phase_output. Il gate NDA/
        contratto riguarda l'ESISTENZA del record documento, non la
        riuscita della sua stampa."""
        self.ensure_one()
        template = self.env.ref(template_xmlid, raise_if_not_found=False)
        if not template:
            _logger.warning(
                "Template Typst '%s' non trovato: PDF non generato per erpv6.contract.document #%s.",
                template_xmlid, contract_doc.id)
            return False

        data = self._build_contract_doc_data(contract_doc.doc_type)
        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            template.id, 'erpv6.contract.document', contract_doc.id, data=data)
        if typst_doc.status != 'ready':
            _logger.warning(
                "Generazione PDF fallita per erpv6.contract.document #%s (typst doc #%s, template '%s'): %s",
                contract_doc.id, typst_doc.id, template_xmlid,
                typst_doc.error_message or 'nessun dettaglio')
            return False

        pdf_bytes = base64.b64decode(typst_doc.pdf_file)
        contract_doc.sudo().write({
            'content': typst_doc.pdf_file,
            'file_name': typst_doc.pdf_filename,
            'hash': hashlib.sha256(pdf_bytes).hexdigest(),
        })
        return typst_doc

    def _ensure_nda_document(self):
        """Gate automatico NDA (Compito "wizard-prodotto-consulenza",
        25/08/2026): 'un NDA unico per cliente/progetto, si attiva alla
        ricezione delle prime informazioni strutturate e riservate' (Denis)
        - qui applicato alla chiusura della fase configurata con
        richiede_nda=True. Idempotente: se il contratto ha gia' un
        documento doc_type='nda', non ne crea un secondo.

        Genera anche il PDF reale (parte 2 dello stesso compito, 25/08/2026)
        via _generate_contract_document_pdf: l'invio reale a Documenso
        (erpv6.sign.request) resta comunque un'azione separata e manuale,
        per scelta esplicita di Denis in questo giro (vuole prima vedere il
        PDF)."""
        self.ensure_one()
        contract = self._ensure_contract()
        existing_nda = contract.document_ids.filtered(lambda d: d.doc_type == 'nda')
        if existing_nda:
            return existing_nda
        nda_doc = self.env['erpv6.contract.document'].sudo().create({
            'name': _("NDA - %s") % self.name,
            'contract_id': contract.id,
            'doc_type': 'nda',
        })
        self._generate_contract_document_pdf(nda_doc, 'erpv6_production.typst_template_nda')
        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'interazione_consulente',
            'decision_method': 'deterministico',
            'description': _("NDA (documento #%s) creato automaticamente all'avanzamento della fase "
                              "con richiede_nda.") % nda_doc.id,
            'phase_before_id': self.phase_id.id,
        })
        return nda_doc

    def _ensure_contratto_o_promessa(self):
        """Gate automatico Contratto (stesso compito): 'si attiva dopo la
        call, e se non hanno gia' pagato il primo SAL una promessa di
        pagherò' (Denis) - due varianti sullo stesso erpv6.contract.document
        (doc_type='service' o 'promise_to_pay'), decise da "esiste gia' una
        tranche numero 1 incassata su questa produzione".

        Idempotente come _ensure_nda_document: se esiste gia' un documento
        service/promise_to_pay su questo contratto non ne crea un secondo -
        la variante scelta al momento giusto resta quella valida, cambiarla
        a posteriori (es. dopo un pagamento tardivo) e' una decisione
        umana, non automatica."""
        self.ensure_one()
        contract = self._ensure_contract()
        existing = contract.document_ids.filtered(lambda d: d.doc_type in ('service', 'promise_to_pay'))
        if existing:
            return existing
        primo_sal_pagato = bool(self.tranche_ids.filtered(
            lambda t: t.tranche_number == 1 and t.stato == 'incassata'))
        doc_type = 'service' if primo_sal_pagato else 'promise_to_pay'
        doc = self.env['erpv6.contract.document'].sudo().create({
            'name': (_("Contratto - %s") % self.name) if doc_type == 'service'
                    else (_("Promessa di Pagamento - %s") % self.name),
            'contract_id': contract.id,
            'doc_type': doc_type,
        })
        template_xmlid = (
            'erpv6_production.typst_template_contratto_consulenza' if doc_type == 'service'
            else 'erpv6_production.typst_template_promessa_pagamento'
        )
        self._generate_contract_document_pdf(doc, template_xmlid)
        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'interazione_consulente',
            'decision_method': 'deterministico',
            'description': _(
                "%(tipo)s (documento #%(id)s) creato automaticamente all'avanzamento della fase con "
                "richiede_contratto (primo SAL gia' pagato: %(pagato)s)."
            ) % {
                'tipo': _('Contratto') if doc_type == 'service' else _('Promessa di pagamento'),
                'id': doc.id, 'pagato': _('si') if primo_sal_pagato else _('no'),
            },
            'phase_before_id': self.phase_id.id,
        })
        return doc

    def _do_advance_after_gate(self):
        """Azione 'procedi' agganciata al gate (vedi _open_phase_gate) --
        no-arg per costruzione (erpv6.agent.confirmation puo' chiamare solo
        metodi senza argomenti): legge phase_gate_next_phase_id gia' salvato
        sull'ordine, chiama advance_phase() (l'unico scrittore finale della
        fase, invariato) e chiude il task di tracciabilita'.

        Compito "wizard-prodotto-consulenza" (25/08/2026): PRIMA di
        avanzare per davvero, se la fase che si sta chiudendo e' configurata
        (via prodotto_id) con richiede_pagamento=True, blocca sollevando
        UserError finche' le tranche non risultano tutte 'incassata' -
        erpv6.agent.confirmation._do_phase_decision cattura QUALUNQUE
        eccezione di action_method e la trasforma in stato 'action_error'
        (mai un avanzamento silenzioso), quindi basta sollevare qui, nessuna
        modifica necessaria a erpv6_agent. richiede_nda/richiede_contratto
        vengono invece applicati (mai bloccanti) subito dopo il controllo
        pagamento, prima dell'avanzamento vero."""
        self.ensure_one()
        next_phase = self.phase_gate_next_phase_id
        if not next_phase:
            raise UserError(_("Nessuna fase in attesa di decisione su questa produzione."))

        current_phase = self.phase_id
        fase_config = self._get_fase_config(current_phase)
        if fase_config and fase_config.richiede_pagamento:
            tranches = self._ensure_tranches_for(fase_config)
            pending = tranches.filtered(lambda t: t.stato != 'incassata')
            if pending:
                raise UserError(_(
                    "Impossibile avanzare da '%(fase)s' a '%(next)s': il prodotto '%(prodotto)s' richiede "
                    "il pagamento su questa fase e %(n)d tranche/e risultano ancora da incassare (%(nums)s). "
                    "Conferma l'incasso (azione 'Marca Incassata' sulla tranche) prima di poter procedere."
                ) % {
                    'fase': current_phase.name, 'next': next_phase.name,
                    'prodotto': fase_config.prodotto_id.name,
                    'n': len(pending), 'nums': ', '.join(str(t.tranche_number) for t in pending),
                })

        if fase_config and fase_config.richiede_nda:
            self._ensure_nda_document()
        if fase_config and fase_config.richiede_contratto:
            self._ensure_contratto_o_promessa()

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
        nota" finche' non arriva un 'procedi').

        Corretto il 25/08/2026 (Compito "wizard-prodotto-consulenza"): PRIMA
        questo controllava solo decision == 'procedi', assumendo che
        l'azione fosse sempre riuscita - ma ora _do_advance_after_gate puo'
        fallire per davvero (gate di pagamento non soddisfatto), lasciando
        confirmation.state='action_error'. In quel caso i campi di gate
        NON vanno svuotati: se li svuotassimo, si perderebbe la fase in
        attesa senza che l'avanzamento sia mai avvenuto. Lasciandoli
        valorizzati, il prossimo giro di evaluate_and_advance rileva che il
        gate esistente ha decision_result='procedi' ma non e' piu'
        'pending', e ne riapre uno nuovo (vedi _evaluate_and_advance_one) -
        il consulente viene ririnterpellato dopo aver confermato il
        pagamento."""
        self.ensure_one()
        if decision == 'procedi' and confirmation.state == 'confirmed':
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

        contract = self._create_contract_record()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.contract',
            'res_id': contract.id,
            'view_mode': 'form',
            'target': 'current',
        }

    # ------------------------------------------------------------------
    # Metodi "analisi win-win" e "profilo DISC" (Compito Denis, notte
    # 24-25/08/2026, ragionando sul funnel commerciale): stesso pattern
    # KB+AI gia' usato da ogni agente del progetto (Kaizen/Susanna/Sabrina/
    # Andrea/Claudio/Argus/Alessandro) - un erpv6.omni.route.config per
    # task_type, un'istruzione reale in erpv6.kb (kb_type='metodo_v6', vedi
    # data/kb_metodo_winwin_disc_data.xml), execute_ai_task con dati REALI,
    # mai un motore nuovo. Un unico metodo condiviso (_run_metodo_ai)
    # invece di duplicare la stessa logica due volte - principio "non
    # duplicare" di CLAUDE.md: le uniche differenze reali tra i due metodi
    # sono quale voce KB/route usare e come formattare il risultato in
    # relazione leggibile, tutto il resto (raccolta dati, chiamata AI,
    # salvataggio come documento tracciato) e' identico.
    _METODO_CONFIG = {
        'winwin': {
            'kb_xmlid': 'erpv6_production.kb_metodo_analisi_winwin',
            'omni_task_type': 'winwin_analysis_generation',
            'doc_category': 'proposal',
            'is_final_client_facing': True,
            'doc_title': "Analisi Win-Win",
        },
        'disc': {
            'kb_xmlid': 'erpv6_production.kb_metodo_profilo_disc',
            'omni_task_type': 'disc_profile_generation',
            'doc_category': 'other',
            'is_final_client_facing': False,
            'doc_title': "Profilo DISC",
        },
    }

    def action_genera_analisi_win_win(self):
        self.ensure_one()
        return self._run_metodo_ai('winwin')

    def action_determina_profilo_disc(self):
        self.ensure_one()
        return self._run_metodo_ai('disc')

    def _build_metodo_context_data(self):
        """Dati REALI disponibili per i due metodi sopra: campi strutturati
        dell'intervista (gia' su questo record) + TUTTE le risposte di
        TUTTE le sessioni d'intervista di questo lead, comprese quelle
        testuali libere (vedi erpv6.interview.answer) - richiesto
        esplicitamente da Denis per il DISC ("tutto passa... dalle domande
        iniziali e integrative... oltre che dai campi liberi"), e utile
        anche al win-win per non limitarsi ai soli 5 campi gia' mappati su
        questo ordine. Nessun dato inventato: solo cio' che l'intervista ha
        davvero raccolto, in ordine cronologico di risposta."""
        self.ensure_one()
        sessions = self.env['erpv6.interview.session'].sudo().search(
            [('lead_id', '=', self.lead_id.id)], order='create_date asc')
        answers = []
        for session in sessions:
            for answer in session.answer_ids.sorted('id'):
                value = answer.option_id.value if answer.option_id else answer.value_text
                if not value:
                    continue
                answers.append({
                    'domanda': answer.question_id.question_text,
                    'risposta': value,
                    'testo_libero': bool(answer.value_text and not answer.option_id),
                })
        return {
            'azienda': self.lead_id.name or '',
            'tipo_progetto': self.interview_tipo_progetto or '',
            'budget': self.interview_budget or '',
            'tempistiche': self.interview_tempistiche or '',
            'destinatario_business_plan': self.interview_destinatario or '',
            'fatturato': self.interview_fatturato or '',
            'verticale': self.verticale or '',
            'risposte_intervista': answers,
        }

    def _run_metodo_ai(self, method_code):
        """Esegue il metodo (winwin o disc): legge il prompt reale da KB,
        raccoglie i dati reali, chiama l'AI via OmniRoute, salva il
        risultato come erpv6.library.document collegato a questa produzione
        (stesso schema gia' usato da _generate_phase_output sopra e da
        erpv6_kaizen._write_document_report - mai un terzo modo di salvare
        un output AI). Nessun fallback silenzioso: se manca il prompt, se
        non ci sono dati d'intervista, o se la chiamata AI fallisce, si
        alza un UserError reale invece di produrre un risultato inventato
        o vuoto (regola anti-allucinazione)."""
        self.ensure_one()
        config = self._METODO_CONFIG[method_code]
        kb = self.env.ref(config['kb_xmlid'], raise_if_not_found=False)
        kb = kb.sudo() if kb else kb
        if not kb or not kb.content:
            raise UserError(_(
                "Il metodo '%s' non ha ancora un prompt configurato (voce KB mancante o vuota) - "
                "impossibile procedere senza istruzioni reali."
            ) % config['doc_title'])

        context_data = self._build_metodo_context_data()
        has_structured_data = any([
            context_data['tipo_progetto'], context_data['budget'], context_data['tempistiche'],
        ])
        if not context_data['risposte_intervista'] and not has_structured_data:
            raise UserError(_(
                "Nessun dato reale d'intervista trovato per il lead '%(lead)s': il metodo '%(m)s' "
                "non puo' essere eseguito senza dati reali su cui basarsi."
            ) % {'lead': self.lead_id.name or self.lead_id.id, 'm': config['doc_title']})

        # Lettura diretta del contenuto (stesso schema di
        # validation_session.py._get_analyst_prompt_template e di
        # kaizen_agent.py rules_kbs), non get_content_for_ai(): quella
        # applica un controllo di accesso pensato per un utente che
        # consulta la KB dalla UI, qui il chiamante e' sempre codice interno
        # che gia' sa di poter leggere una KB kb_type='metodo_v6' pubblica
        # (kb e' gia' in sudo, vedi sopra).
        system_prompt = kb.content
        user_content = json.dumps(context_data, ensure_ascii=False, indent=2)

        result = self.env['erpv6.omni.bridge'].execute_ai_task(
            task_type=config['omni_task_type'],
            payload={
                'temperature': 0.3,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': _("Dati reali raccolti su questa azienda/produzione "
                                                    "(nessun altro dato esiste oltre a questi):\n%s") % user_content},
                ],
            },
            context={'source': 'erpv6_production:_run_metodo_ai:%s' % method_code, 'order_id': self.id},
        )
        if not result.get('success'):
            raise UserError(_("Chiamata AI fallita per il metodo '%(m)s': %(e)s") % {
                'm': config['doc_title'], 'e': result.get('error') or _('nessun dettaglio disponibile')})
        try:
            ai_content = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            raise UserError(_("Risposta AI in formato inatteso per il metodo '%s'.") % config['doc_title'])

        parsed = self._parse_metodo_ai_json(ai_content)
        report_text = self._build_metodo_report_text(method_code, ai_content, parsed)

        document = self.env['erpv6.library.document'].register_document(
            project_id=self.lead_id.id,
            name=_("%(title)s — %(lead)s") % {'title': config['doc_title'], 'lead': self.lead_id.name or self.name},
            category=config['doc_category'],
            origin='generated',
            source_model='erpv6.production.order',
            source_res_id=self.id,
            is_final=config['is_final_client_facing'],
            file_data=base64.b64encode(report_text.encode('utf-8')),
            file_name='%s_%s_%s.md' % (method_code, self.id, fields.Date.context_today(self).isoformat()),
        )

        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'documento_generato',
            'decision_method': 'ai',
            'description': _("Metodo '%(m)s' eseguito, documento generato: '%(doc)s' (#%(id)s).") % {
                'm': config['doc_title'], 'doc': document.name, 'id': document.id},
        })

        now = fields.Datetime.now()
        if method_code == 'winwin':
            self.winwin_ultima_analisi_date = now
        else:
            self.disc_ultima_analisi_date = now
            if parsed:
                self.disc_profilo_dominante = parsed.get('profilo_dominante') or False

        self.message_post(body=_(
            "Metodo '%(m)s' eseguito: documento '%(doc)s' generato e collegato a questa produzione."
        ) % {'m': config['doc_title'], 'doc': document.name})

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.library.document',
            'res_id': document.id,
            'view_mode': 'form',
            'target': 'current',
        }

    @staticmethod
    def _parse_metodo_ai_json(ai_content):
        """Come _parse_ai_json_response in erpv6_validation: la risposta
        attesa e' JSON puro, ma un provider puo' comunque incapsularla in
        un code fence markdown - stesso trattamento tollerante gia' in uso
        li'. Ritorna None (non {}) se non e' JSON valido, cosi' il
        chiamante puo' distinguere "JSON valido ma vuoto" da "non era JSON"
        e riportare comunque il testo grezzo nella relazione invece di
        scartarlo silenziosamente."""
        raw = (ai_content or '').strip()
        if raw.startswith('```'):
            raw = raw.strip('`')
            if raw.lower().startswith('json'):
                raw = raw[4:]
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None

    def _build_metodo_report_text(self, method_code, ai_content, parsed):
        """Relazione leggibile (markdown) a partire dal JSON strutturato
        dell'AI - stesso schema di _build_md_report_content in
        erpv6_kaizen/models/kaizen_rule_engine.py (report .md tracciato via
        register_document, mai un file su disco locale). Se l'AI non ha
        risposto con JSON valido, il testo grezzo viene comunque riportato
        per intero (mai scartato) con un avviso esplicito, cosi' un umano
        puo' comunque leggerlo e capire cosa e' andato storto."""
        self.ensure_one()
        title = self._METODO_CONFIG[method_code]['doc_title']
        lines = [
            "# %s — %s" % (title, self.lead_id.name or self.name),
            "",
            _("Generato automaticamente dal metodo AI erpv6 il %s, sui dati reali raccolti "
              "dall'intervista di questo lead.") % fields.Datetime.now(),
            "",
        ]
        if parsed is None:
            lines.append(_("**Attenzione**: la risposta AI non era in formato JSON valido, riportata "
                            "cosi' com'e' di seguito senza elaborazione:"))
            lines.append("")
            lines.append(ai_content or '')
            return "\n".join(lines)

        if method_code == 'winwin':
            for i, azione in enumerate(parsed.get('azioni_winwin') or [], start=1):
                lines.append("## %d. %s" % (i, azione.get('titolo') or _('(senza titolo)')))
                lines.append("")
                if azione.get('come_funziona'):
                    lines.append(_("**Come funziona**: %s") % azione['come_funziona'])
                    lines.append("")
                if azione.get('beneficio_azienda'):
                    lines.append(_("**Beneficio per l'azienda**: %s") % azione['beneficio_azienda'])
                    lines.append("")
                if azione.get('beneficio_controparte'):
                    lines.append(_("**Beneficio per la controparte**: %s") % azione['beneficio_controparte'])
                    lines.append("")
                if azione.get('basata_su'):
                    lines.append(_("_Basata su_: %s") % azione['basata_su'])
                    lines.append("")
            if parsed.get('sintesi_per_il_cliente'):
                lines.append("## " + _("Sintesi"))
                lines.append("")
                lines.append(parsed['sintesi_per_il_cliente'])
                lines.append("")
        else:  # disc
            secondario = parsed.get('profilo_secondario')
            lines.append("## " + _("Profilo rilevato: %s%s") % (
                parsed.get('profilo_dominante') or '?',
                (_(" (secondario: %s)") % secondario) if secondario else ''))
            lines.append("")
            lines.append(_("**Confidenza**: %s") % (parsed.get('confidenza') or _('non indicata')))
            lines.append("")
            if parsed.get('indizi_osservati'):
                lines.append("### " + _("Indizi osservati"))
                for indizio in parsed['indizi_osservati']:
                    lines.append("- %s" % indizio)
                lines.append("")
            if parsed.get('implicazioni_comunicative'):
                lines.append("### " + _("Come comunicare con questa persona"))
                lines.append("")
                lines.append(parsed['implicazioni_comunicative'])
                lines.append("")

        if parsed.get('flagged_missing_data'):
            lines.append("### " + _("Dati mancanti segnalati dall'AI"))
            lines.append("")
            lines.append(parsed['flagged_missing_data'])
            lines.append("")

        return "\n".join(lines)

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
