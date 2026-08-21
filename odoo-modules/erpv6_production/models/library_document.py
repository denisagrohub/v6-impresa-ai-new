import json
import logging
import uuid

from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# Il cron di retry automatico (_cron_retry_kb_extraction_failures) non ritenta
# all'infinito un documento che continua a fallire per un rate limit Groq
# persistente -- dopo questo numero di tentativi automatici si ferma e lascia
# il documento in stato di errore per intervento manuale (kb_extraction_needs_retry
# resta True, ma la ricerca del cron esclude i documenti che l'hanno raggiunto).
KB_EXTRACTION_MAX_AUTO_RETRIES = 5

# Stessi valori di erpv6.typst.template.category (erpv6_typst) -- duplicati
# qui (non importati) per non far dipendere questo Selection da un import
# cross-modulo solo per una lista di tuple; da tenere allineato a mano se
# la lista in typst_template.py cambia.
CASE_STUDY_WORK_TYPES = [
    ('business_plan', 'Business Plan'),
    ('financial_report', 'Report Finanziario'),
    ('bando_application', 'Candidatura Bando'),
    ('proposal', 'Proposta Commerciale'),
    ('contract', 'Contratto'),
    ('relazione', 'Relazione'),
    ('manuale', 'Manuale'),
    ('custom', 'Personalizzato'),
]


class LibraryDocument(models.Model):
    """Estende erpv6.library.document (definito in erpv6_library, che NON
    puo' dipendere da erpv6_omni_bridge/erpv6_validation senza creare un
    ciclo -- erpv6_production gia' dipende da entrambi, vedi kb_validation_gate.py)
    con il trigger automatico: caricare un documento in categoria 'kb_source'
    avvia l'estrazione AI e mette le voci create in validazione. Serve anche
    mail.activity.mixin (non solo mail.thread) per poter chiamare
    activity_schedule() -- stesso mixin gia' usato da
    erpv6.production.order/erpv6.typst.document per lo stesso scopo.
    """
    _name = 'erpv6.library.document'
    _inherit = ['erpv6.library.document', 'mail.thread', 'mail.activity.mixin']

    kb_extraction_completed_chunks = fields.Integer(
        string="Blocchi KB completati", default=0, copy=False,
        help="Indice (0-based) dell'ultimo blocco di primo livello completato con "
             "successo durante l'estrazione KB -- checkpoint di ripresa: un rilancio "
             "di _process_kb_source riparte da qui invece di rielaborare (e "
             "duplicare) i blocchi gia' committati in un tentativo precedente "
             "interrotto a meta' documento (vedi _commit_kb_extraction_batch).")
    kb_extraction_needs_retry = fields.Boolean(
        string="Estrazione KB da ritentare", default=False, copy=False,
        help="True quando l'ultimo tentativo e' fallito per un errore TRANSITORIO "
             "(rate limit Groq, vedi _kb_extraction_error_is_transient) -- il cron "
             "_cron_retry_kb_extraction_failures cerca i documenti con questo flag "
             "per ritentare da solo (il checkpoint rende sicuro riprovare). Resta "
             "False per errori permanenti (config/formato), che il cron non ritenta.")
    kb_extraction_retry_count = fields.Integer(
        string="Tentativi automatici falliti", default=0, copy=False,
        help="Contatore dei soli tentativi lanciati dal cron (non da un rilancio "
             "manuale) -- oltre KB_EXTRACTION_MAX_AUTO_RETRIES il cron smette di "
             "ritentare questo documento e serve intervento manuale.")
    kb_awaiting_file = fields.Boolean(
        string="In attesa del file (KB)", default=False, copy=False,
        help="True quando create() ha visto una categoria KB (kb_source/kb_case_study) "
             "senza ancora un file allegato -- il widget file del form web spesso salva "
             "il record PRIMA (create() senza file) e allega il binario in una write() "
             "separata poco dopo (verificato dal vivo sul documento #27, creato le "
             "11:11:27 del 20/08/2026 con l'allegato scritto solo alle 11:12:36): senza "
             "questo flag il trigger automatico -- cablato solo in create() -- non scatta "
             "mai, e il documento resta bloccato per sempre senza nessuna traccia (vedi "
             "write() sotto, che lo consuma non appena il file arriva).")

    case_study_work_type = fields.Selection(
        CASE_STUDY_WORK_TYPES, string="Tipo di lavoro",
        help="Solo per categoria 'Caso studio (lavoro già eseguito)': tipo di "
             "documento, usato per cercare template esistenti compatibili "
             "(stessi valori di erpv6.typst.template.category).")
    case_study_match_status = fields.Selection([
        ('pending', 'Da verificare'),
        ('suggested_reuse', 'AI: template esistente compatibile'),
        ('suggested_new', 'AI: nessun template compatibile'),
        ('confirmed_reuse', 'Confermato: resta caso studio'),
        ('confirmed_new', 'Confermato: nuovo template in lavorazione'),
    ], string="Stato verifica template", default='pending', copy=False)
    case_study_matched_package_module_id = fields.Many2one(
        'erpv6.package.module', string="Template/modulo suggerito dall'AI", copy=False)
    case_study_match_reasoning = fields.Text(string="Motivazione AI", copy=False)
    case_study_generated_package_module_ids = fields.Many2many(
        'erpv6.package.module', string="Template generati da questo caso studio", copy=False)

    kb_project_id = fields.Many2one(
        'project.project', string="Progetto KB", compute='_compute_kb_project_id',
        help="Il vero project.project (con i task di fase, creato da _ensure_kb_project/"
             "_ensure_template_transformation_project) -- NON e' lo stesso record del campo "
             "'Progetto' qui sopra (project_id, che e' un crm.lead usato solo come contenitore "
             "interno). Segnalato dal vivo dall'utente il 20/08/2026: senza questo campo il "
             "progetto reale non era raggiungibile dal documento in nessun modo.")

    @api.depends('project_id')
    def _compute_kb_project_id(self):
        for document in self:
            order = self.env['erpv6.production.order'].search(
                [('lead_id', '=', document.project_id.id)], limit=1)
            document.kb_project_id = order.project_id if order else False

    def action_open_kb_project(self):
        self.ensure_one()
        if not self.kb_project_id:
            raise UserError(_("Nessun progetto ancora creato per questo documento."))
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'project.project',
            'res_id': self.kb_project_id.id,
            'view_mode': 'form',
            'target': 'current',
        }

    @api.model_create_multi
    def create(self, vals_list):
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        for vals in vals_list:
            # 'Progetto' (project_id, in realta' un crm.lead -- vedi
            # _ensure_kb_project) resta required=True a livello di campo
            # (erpv6_library), ma per le due categorie automatiche KB non ha
            # senso chiederlo all'utente in upload: il vero project.project
            # dedicato viene creato DOPO, in automatico, da
            # _ensure_kb_project/_ensure_template_transformation_project.
            # NON si riusa qui il lead fisso 'Amministrazione KB' come
            # project_id diretto: _ensure_kb_project e' idempotente PER
            # production order (quindi per lead), quindi tutti i documenti
            # senza progetto scelto finirebbero sullo STESSO production
            # order e condividerebbero un unico project.project invece di
            # uno ciascuno. Si crea invece un lead dedicato per documento,
            # con lo stesso referente (user_id) del lead fisso, cosi'
            # _ensure_kb_project resta libero di creare un progetto proprio
            # per QUESTO documento.
            if not vals.get('project_id') and vals.get('category') in ('kb_source', 'kb_case_study'):
                new_lead = self.env['crm.lead'].sudo().create({
                    'name': _("KB — %s") % (vals.get('name') or _('Documento senza nome')),
                    'type': 'opportunity',
                    'user_id': kb_admin_lead.user_id.id if kb_admin_lead and kb_admin_lead.user_id else False,
                })
                vals['project_id'] = new_lead.id
        documents = super().create(vals_list)
        for document in documents:
            if document.category == 'kb_source':
                if document.file:
                    document._process_kb_source()
                else:
                    document.kb_awaiting_file = True
            elif document.category == 'kb_case_study':
                if document.file:
                    document._process_kb_case_study()
                else:
                    document.kb_awaiting_file = True
        return documents

    def write(self, vals):
        """Vedi kb_awaiting_file: se il file arriva DOPO create() (write()
        separata del widget form), rilancia qui l'elaborazione automatica che
        altrimenti non scatterebbe mai. Calcolato PRIMA di super().write()
        (sui valori attuali dei record, non sui vals in arrivo) cosi' il
        controllo su kb_awaiting_file/category riflette lo stato pre-scrittura;
        vals.get('file') vero e' condizione sufficiente perche' un client puo'
        anche scrivere altri campi nella stessa write() in cui allega il file."""
        pending = self.browse()
        if vals.get('file'):
            pending = self.filtered(
                lambda d: d.kb_awaiting_file and d.category in ('kb_source', 'kb_case_study'))
        result = super().write(vals)
        for document in pending:
            document.kb_awaiting_file = False
            if document.category == 'kb_source':
                document._process_kb_source()
            elif document.category == 'kb_case_study':
                document._process_kb_case_study()
        return result

    @api.model
    def _cron_retry_kb_extraction_failures(self):
        """Retry automatico sui documenti KB falliti per un errore
        transitorio (rate limit Groq) -- il checkpoint/commit esplicito
        (_commit_kb_extraction_batch) rende sicuro rilanciare l'estrazione
        anche se il tentativo precedente e' stato interrotto a meta' (altro
        429, kill del processo, ecc.): non si perde mai il lavoro gia'
        fatto, quindi basta richiamare _process_kb_source e lasciare che
        riprenda da sola dal blocco giusto. NON ritenta all'infinito (vedi
        KB_EXTRACTION_MAX_AUTO_RETRIES) ne' documenti falliti per un errore
        permanente (kb_extraction_needs_retry resta False in quel caso, vedi
        _kb_extraction_error_is_transient)."""
        documents = self.search([
            ('category', '=', 'kb_source'),
            ('kb_extraction_needs_retry', '=', True),
            ('kb_extraction_retry_count', '<', KB_EXTRACTION_MAX_AUTO_RETRIES),
        ])
        for document in documents:
            document.kb_extraction_retry_count += 1
            _logger.info(
                "Cron retry estrazione KB: documento #%s, tentativo automatico %d/%d",
                document.id, document.kb_extraction_retry_count, KB_EXTRACTION_MAX_AUTO_RETRIES)
            document._process_kb_source(is_auto_retry=True)

    def _kb_extraction_error_is_transient(self, error_text):
        """True se l'errore vale la pena ritentarlo automaticamente via cron.
        Deny-list, non allow-list: con piu' di un provider configurato
        (Groq/Cerebras/OpenRouter) il messaggio finale riporta solo l'ULTIMO
        provider tentato (vedi omni_bridge.py) -- un 429 transitorio su Groq
        seguito da un 402 permanente su Cerebras (l'ultimo tentato) farebbe
        sembrare l'intero fallimento "permanente" con un allow-list basato
        solo su '429', anche se il vero problema si risolverebbe da solo.
        Qui si nega il retry SOLO per segnali chiaramente permanenti
        (indipendenti dal provider, non si risolvono aspettando) -- tutto il
        resto (429, 402, 500, errori di rete, ecc. su uno qualsiasi dei
        provider) viene ritentato, nel dubbio."""
        text = error_text or ''
        permanent_markers = (
            'API Key mancante', 'Nessuna route configurata',
            'Formato file non supportato', 'non contiene testo estraibile',
            'openpyxl non disponibile', 'PyPDF2 non disponibile', 'docx non valido',
            'Nessun contenuto leggibile', 'Nessun file fornito',
        )
        return not any(marker in text for marker in permanent_markers)

    def _process_kb_source(self, is_auto_retry=False):
        """Estrae le voci KB dal documento (create inattive, in categoria di
        transito) e le mette subito in validazione (erpv6_validation) -- mai
        attive senza passare da li'. A differenza di prima NON e' piu'
        tutto-o-niente a livello di intero documento: ogni KB_BATCH_SIZE
        blocchi completati (vedi kb_extraction_service.py) il lavoro fatto
        finora viene creato, mandato in validazione e COMMITTATO
        (_commit_kb_extraction_batch) -- se un blocco successivo fallisce
        (es. rate limit persistente), i batch gia' committati non si perdono
        e un rilancio riparte dal blocco giusto (kb_extraction_completed_chunks)
        invece che da zero. Esito sempre loggato nel chatter del documento, e
        notificato all'utente responsabile (vedi _notify_kb_extraction_result)
        sia come attivita' to-do sia come resoconto Typst inviato via
        email+notifica in-app -- il solo chatter non e' visto proattivamente
        da nessuno (stesso motivo di _notify_stall in production_order.py).
        Per documenti grandi l'estrazione e' sincrona e puo' richiedere
        diversi minuti: un messaggio iniziale avvisa la stima prima di
        partire (_notify_kb_extraction_start).

        :param is_auto_retry: True quando la chiamata viene dal cron
            (_cron_retry_kb_extraction_failures) invece che da create() o da
            un rilancio manuale -- su un fallimento ancora transitorio e
            ancora dentro il budget di tentativi automatici, sopprime la
            notifica rumorosa (attivita'/email) per non spammare l'utente a
            ogni ciclo del cron, il chatter resta comunque sempre completo."""
        self.ensure_one()
        service = self.env['erpv6.kb.extraction.service']
        plan = self._notify_kb_extraction_start()
        self._ensure_kb_project(plan)
        # Commit esplicito qui (stesso principio di _commit_kb_extraction_batch):
        # il documento e il progetto devono restare salvati anche se il
        # blocco che segue (extract_kb_entries, la parte rischiosa/lenta)
        # fallisce o viene ucciso a meta' dal watchdog HTTP (vedi
        # limit_time_real in odoo.conf) -- senza questo commit, un
        # fallimento sul PRIMO blocco farebbe sparire anche il progetto
        # appena creato insieme al resto della transazione non ancora
        # committata.
        self.env.flush_all()
        self.env.cr.commit()
        created_total = self.env['erpv6.kb']

        def on_batch_complete(entries, chunk_number):
            nonlocal created_total
            created_total |= self._commit_kb_extraction_batch(entries, chunk_number)

        try:
            service.extract_kb_entries(
                self.file, self.file_name, notes=self.name,
                start_chunk_index=self.kb_extraction_completed_chunks,
                on_batch_complete=on_batch_complete)
            self.kb_extraction_needs_retry = False
            project = self.project_id._start_production().project_id
            if not created_total:
                self.message_post(body=_("Elaborazione KB: nessuna voce estratta dal documento."))
                self._notify_kb_extraction_result(self.env['erpv6.kb'])
                if project:
                    self.env['project.task'].sudo().create({
                        'name': _("Estrazione completata — nessuna voce estratta"),
                        'project_id': project.id,
                    })
                return
            names = ", ".join(created_total.mapped('name'))
            self.message_post(body=_(
                "Elaborazione KB completata: %(count)d voci create in totale (inattive, in validazione) "
                "— %(names)s"
            ) % {'count': len(created_total), 'names': names})
            self._notify_kb_extraction_result(created_total)
            if project:
                self.env['project.task'].sudo().create({
                    'name': _("Estrazione KB completata — %d voci totali") % len(created_total),
                    'project_id': project.id,
                    'description': _(
                        "Tutti i blocchi elaborati. In attesa di revisione umana (primo gate) e "
                        "approvazione del supervisore KB (secondo gate)."),
                })
        except Exception as e:
            _logger.exception("Elaborazione KB fallita per documento #%s", self.id)
            error_text = str(e)
            advice = self._kb_extraction_failure_advice(error_text)
            transient = self._kb_extraction_error_is_transient(error_text)
            self.kb_extraction_needs_retry = transient
            retries_exhausted = self.kb_extraction_retry_count >= KB_EXTRACTION_MAX_AUTO_RETRIES
            progress_note = (
                _(" %(count)d voci dei blocchi precedenti sono gia' state create e salvate "
                  "(commit indipendente), non vanno perse — un rilancio dell'estrazione "
                  "riprendera' dal blocco %(next)d.") % {
                    'count': len(created_total), 'next': self.kb_extraction_completed_chunks + 1}
                if created_total else ""
            )
            # Su un errore transitorio durante un retry AUTOMATICO (non ancora
            # esaurito il budget di tentativi), il cron ci riprovera' da solo:
            # niente attivita'/email ad ogni singolo tentativo, altrimenti con
            # un ciclo ogni 15 minuti si spammerebbe l'utente per ore. Il
            # chatter resta comunque completo (audit trail), solo la notifica
            # rumorosa viene rimandata al primo esito davvero azionabile
            # (successo, errore permanente, o esaurimento tentativi).
            if is_auto_retry and transient and not retries_exhausted:
                self.message_post(body=_(
                    "Elaborazione KB fallita per errore transitorio (tentativo automatico %(n)d/%(max)d): "
                    "%(error)s%(progress)s\n\nIl cron ritentera' automaticamente più tardi."
                ) % {
                    'n': self.kb_extraction_retry_count, 'max': KB_EXTRACTION_MAX_AUTO_RETRIES,
                    'error': error_text, 'progress': progress_note,
                })
                return
            self.message_post(body=_(
                "Elaborazione KB fallita: %(error)s\n\nSuggerimento: %(advice)s%(progress)s"
            ) % {'error': error_text, 'advice': advice, 'progress': progress_note})
            self._notify_kb_extraction_result(created_total, error=error_text, advice=advice)
            project = self.project_id._start_production().project_id
            if project:
                self.env['project.task'].sudo().create({
                    'name': _("Estrazione KB fallita — richiede intervento"),
                    'project_id': project.id,
                    'description': _("%(error)s\n\nSuggerimento: %(advice)s") % {
                        'error': error_text, 'advice': advice},
                })

    def _commit_kb_extraction_batch(self, entries, chunk_number):
        """Chiamata da extract_kb_entries (via on_batch_complete) ogni
        KB_BATCH_SIZE blocchi di primo livello completati -- crea le voci KB
        del batch (categoria di transito, vedi create_kb_records), le manda
        SUBITO in validazione (non aspetta la fine dell'intero documento) e fa
        un commit ESPLICITO della transazione. Il commit esplicito e' voluto,
        non uno scorrere distratto: un documento lungo (10+ blocchi, 15-30+
        minuti sincroni) puo' essere interrotto a meta' da un riavvio esterno
        del container Odoo (vedi promote_module.sh, gia' successo piu' volte
        durante il debug del documento #9) -- senza commit esplicito il batch
        andrebbe perso comunque, checkpoint o no, perche' l'intera
        _process_kb_source gira altrimenti in un'unica transazione. Il
        progresso (kb_extraction_completed_chunks) viene scritto PRIMA del
        commit cosi' un rilancio successivo (_process_kb_source chiamato di
        nuovo, es. da odoo shell) riparte dal blocco giusto invece di
        ricreare voci duplicate."""
        self.ensure_one()
        service = self.env['erpv6.kb.extraction.service']
        order = self.project_id._start_production()
        project = order.project_id
        created = service.create_kb_records(
            entries, source_label=f'library_document:{self.id}:{self.file_name or self.name}')
        if created:
            sessions = self.env['erpv6.kb.validation.gate'].create_validation_sessions(created)
            # create_validation_sessions e' sincrona (action_start_validation
            # gira tutti i round subito, non in coda) -- a questo punto le
            # sessioni hanno gia' lo stato finale (converged/escalated), utile
            # per generare SUBITO il documento leggibile pre-approvazione
            # invece di aspettare un gate umano che potrebbe non arrivare per
            # ore/giorni.
            try:
                typst_doc = self._send_kb_pending_review_report(created, sessions)
            except Exception:
                typst_doc = None
                _logger.exception(
                    "Generazione/invio resoconto pre-approvazione fallita per documento #%s, non bloccante.",
                    self.id,
                )
            # Il progetto deve mostrare da solo a che punto e' il lavoro
            # (segnalato dal vivo dall'utente il 20/08/2026: prima restava
            # vuoto e bisognava chiedere) -- un task per blocco completato
            # + il resoconto 6 Giudici allegato al progetto, non solo
            # inviato per email/notifica.
            if project:
                self.env['project.task'].sudo().create({
                    'name': _("Blocco %(n)d completato — %(count)d voci in validazione") % {
                        'n': chunk_number, 'count': len(created)},
                    'project_id': project.id,
                    'description': _(
                        "Batch di estrazione KB completato e inviato ai 6 Giudici (validazione "
                        "gia' eseguita in modo sincrono)."),
                })
                self._attach_typst_document_to_project(
                    project, typst_doc,
                    _("Resoconto pre-approvazione 6 Giudici — blocco %d") % chunk_number)
        self.kb_extraction_completed_chunks = chunk_number
        self.message_post(body=_(
            "Elaborazione KB: batch fino al blocco %(chunk)d completato — %(count)d voci create "
            "e inviate in validazione (salvate, non andranno perse anche se un blocco successivo "
            "dovesse fallire)."
        ) % {'chunk': chunk_number, 'count': len(created)})
        # flush_all() prima del commit esplicito: scrive sul cursore anche le
        # eventuali scritture ORM ancora in cache (campi computati/related)
        # prima di chiudere la transazione -- un commit senza flush rischia
        # di lasciar fuori proprio le ultime scritture (kb_extraction_completed_chunks,
        # il messaggio nel chatter) che il checkpoint deve invece garantire.
        self.env.flush_all()
        self.env.cr.commit()
        return created

    def _notify_kb_extraction_start(self):
        """Messaggio informativo iniziale con la stima di blocchi/tempo
        attesi, PRIMA di lanciare l'estrazione vera e propria -- un
        documento grande viene spezzato in piu' chiamate sequenziali con una
        pausa di CHUNK_PACING_SECONDS tra un blocco e l'altro (limite
        gratuito Groq, vedi erpv6_omni_bridge/models/kb_extraction_service.py),
        quindi puo' richiedere diversi minuti, tutto sincrono. Solo
        informativo e mai bloccante: se la stima stessa fallisce (es. file
        illeggibile) non fa nulla qui -- lo stesso errore riemergera' da
        extract_kb_entries e sara' gestito dal percorso di fallimento in
        _process_kb_source. Nessun messaggio per documenti a blocco singolo
        (estrazione rapida, stima non significativa).

        Ritorna il piano (o None se la stima e' fallita/non significativa) --
        riusato da _ensure_kb_project per decidere la soglia progetto senza
        ripetere lo stesso parsing del file una seconda volta."""
        self.ensure_one()
        try:
            plan = self.env['erpv6.kb.extraction.service'].estimate_extraction_plan(self.file, self.file_name)
        except Exception:
            return None
        if plan['chunk_count'] <= 1:
            return plan
        done = self.kb_extraction_completed_chunks
        remaining = max(plan['chunk_count'] - done, 0)
        minutes = (remaining * plan['estimated_seconds'] / plan['chunk_count']) / 60.0 if plan['chunk_count'] else 0
        if done:
            self.message_post(body=_(
                "Elaborazione KB ripresa dal blocco %(next)d/%(count)d (i primi %(done)d blocchi erano "
                "gia' stati completati e salvati in un tentativo precedente) — tempo stimato ~%(minutes).0f "
                "minuti per i blocchi rimanenti, elaborazione sincrona."
            ) % {'next': done + 1, 'count': plan['chunk_count'], 'done': done, 'minutes': minutes})
        else:
            self.message_post(body=_(
                "Elaborazione KB avviata: documento diviso in %(count)d blocchi per rispettare il "
                "limite gratuito Groq (8000 token/minuto) — tempo stimato ~%(minutes).0f minuti, "
                "elaborazione sincrona."
            ) % {'count': plan['chunk_count'], 'minutes': minutes})
        return plan

    def _ensure_kb_project(self, plan):
        """Apre (o riusa, idempotente) un project.project dedicato sulla
        production order collegata -- stesso pattern gia' usato in
        crm_lead.py/_promote_to_opportunity per i clienti qualificati,
        riusato qui per dare la stessa tracciabilita' in Progetti al lavoro
        di analisi KB. SEMPRE, non solo per i documenti multi-blocco (fino
        al commit 2950f91 partiva solo se plan['chunk_count'] > 2): l'utente
        ha chiesto che il documento risulti "salvato" (filed su un progetto)
        subito, prima ancora che _process_kb_source tenti l'estrazione vera
        e propria -- cosi' anche un fallimento sul primissimo blocco (es. il
        thread HTTP ucciso dal watchdog, vedi limit_time_real in odoo.conf)
        non lascia il documento orfano/non tracciato (il chiamante fa un
        commit esplicito subito dopo, vedi _process_kb_source). Il
        supervisore (user_id del progetto) e' sempre il referente KB globale
        (lead fisso 'Amministrazione KB', vedi data/kb_admin_lead_data.xml)
        e non il commerciale del cliente -- e' lui/lei il secondo gate di
        approvazione finale (vedi validation_session.py/action_supervisor_approve),
        indipendentemente dal fatto che il documento appartenga a un cliente
        reale o al lead interno stesso. Idempotente: non crea un secondo
        progetto se la production order ne ha gia' uno (es. cliente gia'
        promosso a opportunity con project.project proprio)."""
        self.ensure_one()
        order = self.project_id._start_production()
        if order.project_id:
            return order.project_id
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        supervisor = kb_admin_lead.user_id if kb_admin_lead else self.project_id.user_id
        project = self.env['project.project'].sudo().create({
            'name': _("Analisi KB — %s") % (self.file_name or self.name),
            'user_id': supervisor.id if supervisor else False,
            'partner_id': self.project_id.partner_id.id if self.project_id.partner_id else False,
        })
        order.project_id = project.id
        count_note = (
            _(" (%(count)d blocchi)") % {'count': plan['chunk_count']}
            if plan and plan.get('chunk_count') else ""
        )
        self.message_post(body=_(
            "Documento salvato nel progetto dedicato%(count_note)s: creato '%(project)s', "
            "supervisore %(supervisor)s."
        ) % {
            'count_note': count_note, 'project': project.name,
            'supervisor': supervisor.name if supervisor else _('nessuno'),
        })
        # Il progetto nasce SEMPRE con almeno un task di fase -- lasciarlo
        # vuoto (solo il nome) non mostra a che punto e' il lavoro, che e'
        # proprio lo scopo di avere un progetto (segnalato dal vivo
        # dall'utente il 20/08/2026). Altri task/allegati si aggiungono
        # via via che l'estrazione avanza, vedi _commit_kb_extraction_batch
        # e la chiusura in _process_kb_source.
        self.env['project.task'].sudo().create({
            'name': _("Estrazione KB — %s") % (self.file_name or self.name),
            'project_id': project.id,
            'description': _("Estrazione automatica delle voci KB dal documento #%d.") % self.id,
        })
        return project

    def _attach_typst_document_to_project(self, project, typst_doc, label):
        """Aggancia il PDF gia' generato (typst_doc.pdf_file) al chatter del
        project.project passato, cosi' chi apre il progetto vede subito i
        documenti prodotti (resoconto 6 Giudici, certificato, ecc.) invece
        di doverli cercare per email/notifica o chiedere -- segnalato dal
        vivo dall'utente il 20/08/2026: il progetto restava vuoto anche
        quando i documenti esistevano gia' altrove. Riusata sia da
        _commit_kb_extraction_batch sia dal certificato dei 6 Giudici
        (validation_session.py._send_kb_validation_certificates_by_category)."""
        if not project or not typst_doc or typst_doc.status != 'ready':
            return
        attachment = self.env['ir.attachment'].sudo().create({
            'name': typst_doc.pdf_filename or ((typst_doc.name or 'documento') + '.pdf'),
            'datas': typst_doc.pdf_file,
            'res_model': 'project.project',
            'res_id': project.id,
        })
        project.message_post(body=label, attachment_ids=[attachment.id])

    # ------------------------------------------------------------------
    # Categoria 'kb_case_study' -- "lavori già eseguiti" come materiale di
    # partenza per template Typst riusabili (vedi memoria di progetto
    # project_kb_case_study_template_idea). L'AI SUGGERISCE solo: la
    # decisione riuso/nuovo template resta sempre a un gate umano
    # (action_confirm_reuse_existing_template/action_confirm_create_new_template),
    # stesso principio anti-allucinazione gia' applicato ai 6 Giudici.
    # ------------------------------------------------------------------

    def _process_kb_case_study(self):
        """Punto di ingresso da create(): se manca il tipo di lavoro non
        c'e' nulla su cui cercare template compatibili, si ferma e chiede
        all'utente di valorizzarlo e rilanciare a mano."""
        self.ensure_one()
        if not self.case_study_work_type:
            self.message_post(body=_(
                "Caso studio caricato senza 'Tipo di lavoro' impostato: valorizzalo e rilancia "
                "manualmente la verifica (azione 'Verifica template esistenti')."))
            return
        self.action_check_existing_template_match()

    def action_check_existing_template_match(self):
        """Cerca erpv6.package.module con template dello stesso
        case_study_work_type; se ne trova, chiede all'AI (route dedicata
        'kb_case_study_match', vedi data/omni_kb_case_study_match_route.xml)
        se uno di essi copre gia' il documento al ~90% delle stesse
        caratteristiche strutturali. Non decide mai da sola: scrive il
        suggerimento e crea sempre un'attivita' per il gate umano."""
        self.ensure_one()
        PackageModule = self.env['erpv6.package.module']
        candidates = PackageModule.search([('typst_template_id.category', '=', self.case_study_work_type)])
        work_type_label = dict(self._fields['case_study_work_type'].selection).get(self.case_study_work_type)
        if not candidates:
            self.case_study_match_status = 'suggested_new'
            self.message_post(body=_(
                "Nessun template esistente per il tipo di lavoro '%(type)s': nessun confronto AI "
                "necessario. Suggerito creare un nuovo template — conferma con l'azione dedicata."
            ) % {'type': work_type_label})
            self._notify_case_study_review()
            return
        service = self.env['erpv6.kb.extraction.service']
        try:
            doc_text = service.extract_raw_text(self.file, self.file_name)
        except Exception as e:
            self.message_post(body=_("Impossibile leggere il documento per il confronto AI: %s") % e)
            return
        candidates_summary = "\n".join(
            "- ID %d | %s: %s (campi richiesti: %s)" % (
                c.id, c.name, c.description or '', c.required_fields or '{}')
            for c in candidates
        )
        system_prompt = (
            "Confronti un documento con dei template/moduli di servizio esistenti dello stesso tipo "
            "di lavoro per capire se uno di essi copre GIA' almeno il 90%% delle stesse "
            "caratteristiche strutturali (stesso scopo, stesse sezioni attese, stessi campi "
            "richiesti) -- non basta lo stesso argomento generico, deve trattarsi quasi dello "
            "stesso tipo di documento. Rispondi SOLO con un oggetto JSON valido, senza markdown "
            "code fence, senza altro testo: "
            '{"match": true|false, "package_module_id": <id o null>, "confidence": <0-100>, '
            '"reasoning": "<breve motivazione in italiano>"}'
        )
        user_content = _(
            "DOCUMENTO DA CLASSIFICARE (estratto):\n%(doc)s\n\nTEMPLATE ESISTENTI (%(type)s):\n%(candidates)s"
        ) % {'doc': doc_text[:8000], 'type': work_type_label, 'candidates': candidates_summary}
        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='kb_case_study_match',
            payload={
                'model': 'gpt-4-turbo',
                'temperature': 0.1,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content},
                ],
            },
            context={'source': 'library_document:action_check_existing_template_match', 'document_id': self.id},
        )
        if not result.get('success'):
            self.message_post(body=_(
                "Verifica AI del template fallita: %(error)s\n\nRilancia manualmente l'azione "
                "'Verifica template esistenti' quando il provider AI è di nuovo disponibile."
            ) % {'error': result.get('error', 'errore sconosciuto')})
            return
        try:
            message_content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(message_content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            self.message_post(body=_(
                "Risposta AI in un formato inatteso durante la verifica del template: %s"
            ) % e)
            return
        self.case_study_match_reasoning = parsed.get('reasoning', '')
        matched_id = parsed.get('package_module_id')
        matched = matched_id and matched_id in candidates.ids and PackageModule.browse(matched_id)
        if parsed.get('match') and matched:
            self.case_study_match_status = 'suggested_reuse'
            self.case_study_matched_package_module_id = matched.id
            self.message_post(body=_(
                "AI: template esistente compatibile trovato — '%(name)s' (confidenza %(conf)s%%). "
                "%(reasoning)s\n\nConferma con l'azione dedicata se sei d'accordo, altrimenti forza "
                "la creazione di un nuovo template."
            ) % {'name': matched.name, 'conf': parsed.get('confidence', '?'), 'reasoning': parsed.get('reasoning', '')})
        else:
            self.case_study_match_status = 'suggested_new'
            self.message_post(body=_(
                "AI: nessun template esistente sufficientemente compatibile (confidenza %(conf)s%%). "
                "%(reasoning)s\n\nConferma con l'azione dedicata per avviare il progetto di "
                "trasformazione in nuovo template."
            ) % {'conf': parsed.get('confidence', '?'), 'reasoning': parsed.get('reasoning', '')})
        self._notify_case_study_review()

    def _notify_case_study_review(self):
        """Attivita' to-do per il gate umano (referente KB globale, stesso
        schema di _notify_kb_extraction_result) -- il suggerimento AI non
        applica MAI nulla da solo."""
        self.ensure_one()
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        user = kb_admin_lead.user_id if kb_admin_lead else self.project_id.user_id
        if not user:
            return
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=_("Verifica template per caso studio: %s") % (self.file_name or self.name),
            note=_("Verifica il suggerimento AI e conferma se riusare un template esistente o "
                   "crearne uno nuovo (scheda documento, categoria Caso studio)."),
            user_id=user.id,
        )

    def action_confirm_reuse_existing_template(self):
        """Gate umano: il documento resta un caso studio, associato al
        template/modulo esistente suggerito (o scelto a mano se diverso) --
        nessun nuovo template creato."""
        self.ensure_one()
        if not self.case_study_matched_package_module_id:
            raise UserError(_("Nessun template suggerito da confermare: seleziona prima un modulo esistente."))
        self.case_study_match_status = 'confirmed_reuse'
        self.message_post(body=_(
            "Confermato: documento archiviato come caso studio, associato al template esistente "
            "'%s'. Nessun nuovo template creato."
        ) % self.case_study_matched_package_module_id.name)

    def action_confirm_create_new_template(self):
        """Gate umano: avvia la trasformazione in nuovo template. Crea il
        progetto dedicato (SOLO le fasi di trasformazione, vedi
        _ensure_template_transformation_project) e una coppia
        erpv6.typst.template + erpv6.package.module per il documento
        principale e per ogni allegato caricato sul documento (sempre
        insieme, vedi _create_template_interview_stub). L'INTERVISTA
        (interview_questions/required_fields) e' generata dall'AI a partire
        dal testo del documento (vedi _generate_case_study_interview): dati
        specifici del caso (es. "investimenti previsti: 50k in Q3") diventano
        domande generiche riusabili (es. "quali investimenti prevedi di
        fare, e quando?"). Il SORGENTE TYPST invece resta uno stub vuoto: a
        differenza dell'intervista (estrarre/riformulare dati), scrivere
        `.typ` valido che legge correttamente `render_data` e' un motore di
        generazione codice ancora da progettare (vedi memoria di progetto
        project_kb_case_study_template_idea) -- qui si scaffolda per non
        bloccare l'archiviazione del lavoro, quella parte la scrive un
        umano nel progetto creato."""
        self.ensure_one()
        if self.case_study_match_status == 'confirmed_new':
            raise UserError(_("Trasformazione già avviata per questo documento."))
        self.case_study_match_status = 'confirmed_new'
        service = self.env['erpv6.kb.extraction.service']
        project = self._ensure_template_transformation_project()

        try:
            main_text = service.extract_raw_text(self.file, self.file_name)
        except Exception:
            main_text = None
        main_pair = self._create_template_interview_stub(self.file_name or self.name, project, main_text)
        self.case_study_generated_package_module_ids = [(4, main_pair.id)]

        attachments = self.env['ir.attachment'].search([
            ('res_model', '=', self._name), ('res_id', '=', self.id), ('res_field', '=', False),
        ])
        for attachment in attachments:
            try:
                attachment_text = service.extract_raw_text(attachment.datas, attachment.name)
            except Exception:
                attachment_text = None
            pair = self._create_template_interview_stub(
                _("%(doc)s — allegato: %(att)s") % {'doc': self.file_name or self.name, 'att': attachment.name},
                project, attachment_text)
            self.case_study_generated_package_module_ids = [(4, pair.id)]

        self.message_post(body=_(
            "Confermato: avviata trasformazione in nuovo template. Creata la coppia "
            "template+intervista per il documento principale%(attachments)s (domande intervista "
            "generate dall'AI dal contenuto, dove riuscito) — resta da scrivere a mano il sorgente "
            "Typst nel progetto '%(project)s'."
        ) % {
            'attachments': _(" e per %d allegati") % len(attachments) if attachments else '',
            'project': project.name,
        })

    def _ensure_template_transformation_project(self):
        """Progetto dedicato SOLO alle fasi di trasformazione
        documento->template (non l'intero ciclo prodotto) -- project.project
        separato da quello di _ensure_kb_project perche' ha uno scopo
        diverso. Idempotente sulla production order collegata."""
        self.ensure_one()
        order = self.project_id._start_production()
        project_name = _("Trasformazione template — %s") % (self.file_name or self.name)
        if order.project_id:
            return order.project_id
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        supervisor = kb_admin_lead.user_id if kb_admin_lead else self.project_id.user_id
        project = self.env['project.project'].sudo().create({
            'name': project_name,
            'user_id': supervisor.id if supervisor else False,
            'partner_id': self.project_id.partner_id.id if self.project_id.partner_id else False,
        })
        order.project_id = project.id
        return project

    def _create_template_interview_stub(self, label, project, source_text=None):
        """Crea la coppia erpv6.typst.template (STUB, sorgente .typ vuoto --
        generarlo e' un motore di generazione codice ancora da progettare) +
        erpv6.package.module collegati via typst_template_id -- SEMPRE
        insieme, mai uno senza l'altro. A differenza del sorgente Typst,
        l'intervista (interview_questions/required_fields) viene popolata
        SUBITO dall'AI se source_text e' disponibile (vedi
        _generate_case_study_interview): e' un compito di
        estrazione/riformulazione dati dal documento, molto piu' vicino a
        quello che kb_extraction_service gia' fa oggi, non generazione di
        codice. Se l'AI fallisce o source_text manca, resta uno stub vuoto
        come prima (task assegnato nel progetto, completabile a mano)."""
        self.ensure_one()
        unique_code = uuid.uuid4().hex[:8]
        template = self.env['erpv6.typst.template'].sudo().create({
            'name': _("Template — %s") % label,
            'code': 'CASE-STUDY-%s-%s' % (self.id, unique_code),
            'category': self.case_study_work_type,
            'description': _(
                "Generato da caso studio: documento #%(doc)s ('%(label)s'). Sorgente Typst da scrivere."
            ) % {'doc': self.id, 'label': label},
        })
        interview_data = self._generate_case_study_interview(source_text) if source_text else None
        package_module = self.env['erpv6.package.module'].sudo().create({
            'name': _("Modulo — %s") % label,
            'code': 'CASE-STUDY-%s-%s' % (self.id, unique_code),
            'price': 0.0,
            'description': _(
                "Generato da caso studio: documento #%s.%s"
            ) % (self.id, '' if interview_data else _(" Domande intervista e campi da compilare.")),
            'typst_template_id': template.id,
            'required_fields': interview_data['required_fields'] if interview_data else False,
            'interview_questions': interview_data['interview_questions'] if interview_data else False,
        })
        if project:
            task_description = (
                _("Intervista generata dall'AI (da rivedere). Manca ancora: erpv6.typst.template "
                  "#%(t)d, il sorgente .typ.") % {'t': template.id}
                if interview_data else
                _("Completare erpv6.typst.template #%(t)d (sorgente .typ) e erpv6.package.module "
                  "#%(m)d (interview_questions/required_fields) a partire dal documento caso "
                  "studio #%(doc)d.") % {'t': template.id, 'm': package_module.id, 'doc': self.id}
            )
            self.env['project.task'].sudo().create({
                'name': _("Scrivere template + intervista: %s") % label,
                'project_id': project.id,
                'description': task_description,
            })
        return package_module

    def _generate_case_study_interview(self, doc_text):
        """A partire dal testo del documento caso studio, chiede all'AI di
        identificare i dati SPECIFICI di questo caso (importi, date, nomi,
        elenchi...) che per un nuovo cliente andrebbero raccolti da capo, e
        per ognuno deriva la domanda d'intervista generica corrispondente
        (es. sezione "Investimenti previsti: 50k in Q3 2026" nel documento
        -> domanda "Quali investimenti prevedi di fare, e quando pensi di
        farli?"). Riguarda SOLO required_fields/interview_questions -- il
        sorgente .typ (dove quei campi finiranno davvero) resta un motore
        separato, vedi action_confirm_create_new_template. Ritorna None se
        l'AI fallisce o non produce nulla di utile: il chiamante lascia lo
        stub vuoto come prima, nessun blocco."""
        if not doc_text:
            return None
        system_prompt = (
            "Leggi questo documento (un lavoro gia' svolto: contratto, business plan, relazione, "
            "manuale...) e individua le sezioni/dati SPECIFICI di questo caso (importi, date, nomi, "
            "elenchi, scelte fatte) che per un NUOVO cliente andrebbero raccolti da capo invece di "
            "essere riusati cosi' come sono. Per ognuno produci una domanda d'intervista in "
            "linguaggio naturale, in italiano, che raccoglierebbe lo stesso TIPO di dato in "
            "generale -- non i valori specifici di questo documento. Rispondi SOLO con un oggetto "
            "JSON valido, senza markdown code fence, senza altro testo: "
            '{"fields": [{"key": "snake_case_breve", "label": "Etichetta breve", '
            '"question": "Domanda in linguaggio naturale?"}, ...]}'
        )
        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='kb_case_study_interview_generation',
            payload={
                'model': 'gpt-4-turbo',
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': doc_text[:8000]},
                ],
            },
            context={'source': 'library_document:_generate_case_study_interview', 'document_id': self.id},
        )
        if not result.get('success'):
            _logger.warning(
                "Generazione intervista AI fallita per documento #%s: %s",
                self.id, result.get('error', 'errore sconosciuto'))
            return None
        try:
            message_content = result['data']['choices'][0]['message']['content']
            fields = json.loads(message_content).get('fields') or []
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning("Risposta AI in formato inatteso per intervista caso studio (doc #%s): %s", self.id, e)
            return None
        fields = [f for f in fields if f.get('key') and f.get('question')]
        if not fields:
            return None
        return {
            'required_fields': {f['key']: {'label': f.get('label', f['key']), 'type': 'text'} for f in fields},
            'interview_questions': "\n".join(f['question'] for f in fields),
        }

    def _kb_extraction_failure_advice(self, error_text):
        """Suggerimento pratico associato al tipo di errore, per rendere
        azionabile la notifica di fallimento invece di un traceback grezzo.
        Classificazione per parole chiave sui messaggi REALI sollevati da
        erpv6_omni_bridge/models/kb_extraction_service.py
        (_call_and_parse_chunk/extract_raw_text) e da
        erpv6_omni_bridge/models/omni_bridge.py.execute_ai_task (429/Too Many
        Requests da requests.raise_for_status su rate limit, "API Key
        mancante"/"Nessuna route configurata"/"Tutti i provider hanno
        fallito" su provider non disponibile) -- non un'invenzione, solo
        instradamento verso l'azione giusta dato il testo gia' presente."""
        text = error_text or ''
        if '429' in text or 'Too Many Requests' in text or 'tokens per minute' in text:
            return _(
                "Limite di frequenza del provider AI superato (probabile piano gratuito Groq, "
                "8000 token/minuto). Riprova tra qualche minuto: la finestra si libera da sola."
            )
        if ('API Key mancante' in text or 'Nessuna route configurata' in text
                or 'Tutti i provider hanno fallito' in text):
            return _(
                "Nessun provider AI attivo o raggiungibile. Verifica la API Key in "
                "Impostazioni > V6 Impresa AI > OmniRoute > Provider."
            )
        if 'JSON valido' in text or 'formato inatteso' in text or 'array di voci' in text:
            return _(
                "La risposta dell'AI non era nel formato atteso. Riprova il caricamento; se "
                "persiste, il documento potrebbe essere troppo denso/ambiguo per l'estrazione "
                "automatica — valuta di caricarlo in piu' parti piu' piccole."
            )
        if ('non contiene testo estraibile' in text or 'openpyxl non disponibile' in text
                or 'PyPDF2 non disponibile' in text or 'docx non valido' in text):
            return _(
                "Problema nel formato/contenuto del file (es. PDF scansionato senza OCR, o libreria "
                "server mancante). Prova a caricare una versione con testo selezionabile, o "
                "converti il file in .docx/.txt."
            )
        if 'Formato file non supportato' in text:
            return _(
                "Formato file non supportato per l'estrazione automatica. Formati supportati: testo "
                "semplice, CSV, XML, .xlsx/.xlsm, .pdf (con testo), .docx."
            )
        if 'Nessun contenuto leggibile' in text or 'Nessun file fornito' in text:
            return _("Il documento risulta vuoto o illeggibile. Verifica il file caricato e ricaricalo.")
        return _(
            "Causa non riconosciuta automaticamente: valuta di riprovare piu' tardi o di caricare "
            "il documento in parti piu' piccole. Se persiste, contatta l'amministratore di sistema."
        )

    def _notify_kb_extraction_result(self, created, error=None, advice=None):
        """Notifica l'esito dell'estrazione KB all'utente responsabile del
        progetto (stesso responsabile che production_order.py._notify_stall/
        _notify_consultant_update notifica per gli eventi di produzione):
        un'attivita' to-do (sempre, stesso tipo 'mail.mail_activity_data_todo'
        gia' usato in tutto il progetto) e un resoconto Typst inviato sia come
        notifica in-app sia come email (vedi _send_kb_extraction_report). Sul
        fallimento, sia il summary sia la nota dell'attivita' riportano anche
        il suggerimento pratico (advice) -- azionabile, non un traceback.
        Il resoconto non deve mai far apparire come fallita un'estrazione
        riuscita: eventuali errori di generazione/invio del resoconto restano
        confinati qui (loggati, non bloccanti) e non risalgono a
        _process_kb_source (vedi commit 63f9659, stesso principio).

        Un lead non ancora promosso a opportunity (vedi crm_lead.py
        _promote_to_opportunity) ha user_id = utente pubblico -- stesso
        controllo qui, altrimenti l'attivita' finirebbe assegnata a un
        utente non reale invece di ricadere su create_uid/utente corrente."""
        self.ensure_one()
        public_user = self.env.ref('base.public_user', raise_if_not_found=False)
        candidates = [self.project_id.user_id, self.create_uid, self.env.user]
        user = next((u for u in candidates if u and u != public_user), self.env.user)

        if error:
            summary = _("Estrazione KB fallita per '%s'") % (self.file_name or self.name)
            note = _("%(error)s\n\nSuggerimento: %(advice)s") % {
                'error': error,
                'advice': advice or self._kb_extraction_failure_advice(error),
            }
        elif not created:
            summary = _("Estrazione KB: nessuna voce trovata in '%s'") % (self.file_name or self.name)
            note = summary
        else:
            summary = _(
                "Estrazione KB completata: %(count)d voci da '%(doc)s' — in validazione (6 Giudici)"
            ) % {'count': len(created), 'doc': self.file_name or self.name}
            note = summary

        self.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=summary,
            note=note,
            user_id=user.id,
        )

        try:
            self._send_kb_extraction_report(user, created, error, advice)
        except Exception:
            _logger.exception(
                "Generazione/invio resoconto Typst estrazione KB fallita per documento #%s, non bloccante.",
                self.id,
            )

    def _send_kb_extraction_report(self, user, created, error=None, advice=None):
        """Genera il resoconto Typst dell'estrazione (template dedicato in
        erpv6_typst) e lo invia all'utente responsabile via
        erpv6.typst.document.action_notify_user (notifica in-app + email).
        Documento interno (mai client-facing) -> resta confinato a
        erpv6_typst/erpv6_library, nessuna certificazione blockchain (vedi
        CLAUDE.md, regola pipeline documenti)."""
        self.ensure_one()
        report_template = self.env.ref(
            'erpv6_typst.typst_template_kb_extraction_report', raise_if_not_found=False)
        if not report_template:
            _logger.warning(
                "Template Typst resoconto estrazione KB non trovato — resoconto non generato per documento #%s.",
                self.id,
            )
            return

        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            report_template.id,
            'erpv6.library.document',
            self.id,
            data=self._build_kb_extraction_report_data(created, error, advice),
        )
        if typst_doc.status != 'ready':
            _logger.warning(
                "Rendering resoconto estrazione KB fallito per documento #%s (typst doc #%s): %s",
                self.id, typst_doc.id, typst_doc.error_message,
            )
            return

        typst_doc.action_notify_user(user)

    def _build_kb_extraction_report_data(self, created, error=None, advice=None):
        """Dati reali (nessun valore inventato) per il template Typst del
        resoconto: solo cio' che e' gia' sul documento/sulle voci KB create,
        piu' il suggerimento pratico (advice) quando c'e' un errore."""
        self.ensure_one()
        kb_type_labels = dict(created._fields['kb_type'].selection) if created else {}
        entries = [{
            'name': kb.name,
            'kb_type': kb_type_labels.get(kb.kb_type, kb.kb_type),
            'category': kb.category_id.name,
        } for kb in created]
        return {
            'source_document': self.name,
            'file_name': self.file_name or '',
            'generated_at': fields.Datetime.to_string(fields.Datetime.now()),
            'entries_count': len(created),
            'entries': entries,
            'error': error or '',
            'advice': advice or '',
        }

    def _send_kb_pending_review_report(self, kbs, sessions):
        """Genera il resoconto Typst leggibile dell'analisi 6 Giudici PRIMA
        di qualsiasi gate umano (le sessioni, a questo punto, sono gia'
        convergenti/escalation -- create_validation_sessions e' sincrona) e
        lo invia al supervisore KB via
        erpv6.typst.document.action_notify_user (notifica in-app + email,
        ora funzionante: vedi configurazione SMTP Brevo). Un documento per
        BATCH (questa chiamata, gia' raggruppata da _commit_kb_extraction_batch),
        non uno per singola voce -- stesso principio del certificato
        (validation_session.py._send_kb_validation_certificates_by_category),
        pensato pero' per supportare la decisione, non per certificarla dopo:
        elenca findings/problemi residui SENZA nessuna informazione di
        approvazione (non e' ancora successa)."""
        self.ensure_one()
        if not kbs:
            return None
        template = self.env.ref(
            'erpv6_typst.typst_template_kb_pending_review_report', raise_if_not_found=False)
        if not template:
            _logger.warning(
                "Template Typst resoconto pre-approvazione non trovato — non generato per documento #%s.",
                self.id,
            )
            return None

        session_by_kb_id = {s.res_id: s for s in sessions if s.res_model == 'erpv6.kb'}
        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            template.id, 'erpv6.library.document', self.id,
            data=self._build_kb_pending_review_report_data(kbs, session_by_kb_id),
        )
        if typst_doc.status != 'ready':
            _logger.warning(
                "Rendering resoconto pre-approvazione fallito per documento #%s (typst doc #%s): %s",
                self.id, typst_doc.id, typst_doc.error_message,
            )
            return None

        supervisor = kbs[0]._resolve_kb_supervisor()
        public_user = self.env.ref('base.public_user', raise_if_not_found=False)
        candidates = [supervisor, self.project_id.user_id, self.create_uid]
        recipients = self.env['res.users']
        for u in candidates:
            if u and u != public_user:
                recipients |= u
        for user in recipients:
            typst_doc.action_notify_user(user)
        return typst_doc

    def _build_kb_pending_review_report_data(self, kbs, session_by_kb_id):
        """Dati reali (nessun valore inventato) per il template Typst del
        resoconto pre-approvazione: una riga per voce KB con lo stato di
        convergenza e i problemi residui rilevati dall'ultimo round --
        nessun campo di approvazione, non e' ancora successa."""
        self.ensure_one()
        status_labels = dict(self.env['erpv6.validation.session']._fields['status'].selection)
        kb_type_labels = dict(kbs._fields['kb_type'].selection) if kbs else {}
        entries = []
        for kb in kbs:
            session = session_by_kb_id.get(kb.id)
            last_round = session.round_ids[-1] if session and session.round_ids else None
            providers_used = ', '.join(sorted(filter(None, set(
                last_round.analysis_ids.mapped('provider_name'))))) if last_round else ''
            entries.append({
                'kb_name': kb.name,
                'kb_type': kb_type_labels.get(kb.kb_type, kb.kb_type),
                'status': status_labels.get(session.status, session.status) if session else '-',
                'rounds_count': len(session.round_ids) if session else 0,
                'final_issues_found': last_round.issues_found if last_round else 0,
                'sesto_uomo_summary': (last_round.sesto_uomo_notes or '') if last_round else '',
                'providers_used': providers_used or '-',
            })
        return {
            'source_document': self.name,
            'file_name': self.file_name or '',
            'generated_at': fields.Datetime.to_string(fields.Datetime.now()),
            'entries_count': len(kbs),
            'entries': entries,
        }
