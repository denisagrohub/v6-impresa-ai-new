import logging

from odoo import api, fields, models, _

_logger = logging.getLogger(__name__)

# Il cron di retry automatico (_cron_retry_kb_extraction_failures) non ritenta
# all'infinito un documento che continua a fallire per un rate limit Groq
# persistente -- dopo questo numero di tentativi automatici si ferma e lascia
# il documento in stato di errore per intervento manuale (kb_extraction_needs_retry
# resta True, ma la ricerca del cron esclude i documenti che l'hanno raggiunto).
KB_EXTRACTION_MAX_AUTO_RETRIES = 5


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

    @api.model_create_multi
    def create(self, vals_list):
        documents = super().create(vals_list)
        for document in documents:
            if document.category == 'kb_source' and document.file:
                document._process_kb_source()
        return documents

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
        """True se l'errore e' verosimilmente transitorio (rate limit Groq,
        incluso il circuit breaker locale che lo segue -- vedi
        CHUNK_RATE_LIMIT_WAIT_SECONDS in kb_extraction_service.py) e quindi
        vale la pena ritentarlo automaticamente via cron. Stesse parole
        chiave del primo ramo di _kb_extraction_failure_advice sotto (non
        fattorizzate in una costante condivisa: quel metodo resta "cosa dire
        all'utente", questo resta "vale la pena ritentare da solo" -- se un
        domani divergono non si vuole che un cambio nell'uno rompa
        silenziosamente l'altro). Tutti gli altri errori (API Key mancante,
        formato non supportato, file illeggibile, ecc.) sono permanenti: il
        cron non li ritenta, sprecherebbe cicli senza mai risolversi da soli."""
        text = error_text or ''
        return '429' in text or 'Too Many Requests' in text or 'tokens per minute' in text

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
            if not created_total:
                self.message_post(body=_("Elaborazione KB: nessuna voce estratta dal documento."))
                self._notify_kb_extraction_result(self.env['erpv6.kb'])
                return
            names = ", ".join(created_total.mapped('name'))
            self.message_post(body=_(
                "Elaborazione KB completata: %(count)d voci create in totale (inattive, in validazione) "
                "— %(names)s"
            ) % {'count': len(created_total), 'names': names})
            self._notify_kb_extraction_result(created_total)
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
                self._send_kb_pending_review_report(created, sessions)
            except Exception:
                _logger.exception(
                    "Generazione/invio resoconto pre-approvazione fallita per documento #%s, non bloccante.",
                    self.id,
                )
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
        """Se il documento richiede piu' di 2 blocchi di primo livello (quindi
        piu' chiamate AI, piu' tempo, piu' rischio di fallimento parziale),
        apre un project.project dedicato sulla production order collegata --
        stesso pattern gia' usato in crm_lead.py/_promote_to_opportunity per
        i clienti qualificati, riusato qui per dare la stessa tracciabilita'
        in Progetti al lavoro di analisi KB. Il supervisore (user_id del
        progetto) e' sempre il referente KB globale (lead fisso
        'Amministrazione KB', vedi data/kb_admin_lead_data.xml) e non il
        commerciale del cliente -- e' lui/lei il secondo gate di
        approvazione finale (vedi validation_session.py/action_supervisor_approve),
        indipendentemente dal fatto che il documento appartenga a un cliente
        reale o al lead interno stesso. Idempotente: non crea un secondo
        progetto se la production order ne ha gia' uno (es. cliente gia'
        promosso a opportunity con project.project proprio)."""
        self.ensure_one()
        if not plan or plan.get('chunk_count', 0) <= 2:
            return
        order = self.project_id._start_production()
        if order.project_id:
            return
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        supervisor = kb_admin_lead.user_id if kb_admin_lead else self.project_id.user_id
        project = self.env['project.project'].sudo().create({
            'name': _("Analisi KB — %s") % (self.file_name or self.name),
            'user_id': supervisor.id if supervisor else False,
            'partner_id': self.project_id.partner_id.id if self.project_id.partner_id else False,
        })
        order.project_id = project.id
        self.message_post(body=_(
            "Documento abbastanza corposo (%(count)d blocchi) da meritare un progetto dedicato: "
            "creato '%(project)s', supervisore %(supervisor)s."
        ) % {
            'count': plan['chunk_count'], 'project': project.name,
            'supervisor': supervisor.name if supervisor else _('nessuno'),
        })

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
            return
        template = self.env.ref(
            'erpv6_typst.typst_template_kb_pending_review_report', raise_if_not_found=False)
        if not template:
            _logger.warning(
                "Template Typst resoconto pre-approvazione non trovato — non generato per documento #%s.",
                self.id,
            )
            return

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
            return

        supervisor = kbs[0]._resolve_kb_supervisor()
        public_user = self.env.ref('base.public_user', raise_if_not_found=False)
        candidates = [supervisor, self.project_id.user_id, self.create_uid]
        recipients = self.env['res.users']
        for u in candidates:
            if u and u != public_user:
                recipients |= u
        for user in recipients:
            typst_doc.action_notify_user(user)

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
