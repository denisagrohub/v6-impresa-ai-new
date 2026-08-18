import logging

from odoo import api, fields, models, _

_logger = logging.getLogger(__name__)


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

    @api.model_create_multi
    def create(self, vals_list):
        documents = super().create(vals_list)
        for document in documents:
            if document.category == 'kb_source' and document.file:
                document._process_kb_source()
        return documents

    def _process_kb_source(self):
        """Estrae le voci KB dal documento (create inattive) e le mette
        subito in validazione (erpv6_validation) -- mai attive senza
        passare da li'. Tutto-o-niente: un chunk fallito scarta l'intera
        estrazione, nessuna KB parziale (comportamento invariato, vedi
        erpv6.kb.extraction.service.extract_kb_entries). Esito sempre
        loggato nel chatter del documento, e notificato all'utente
        responsabile (vedi _notify_kb_extraction_result) sia come attivita'
        to-do sia come resoconto Typst inviato via email+notifica in-app --
        il solo chatter non e' visto proattivamente da nessuno (stesso
        motivo di _notify_stall in production_order.py). Per documenti
        grandi (piu' chunk, vedi CHUNK_PACING_SECONDS nel servizio)
        l'estrazione e' sincrona e puo' richiedere diversi minuti: un
        messaggio iniziale avvisa la stima prima di partire
        (_notify_kb_extraction_start)."""
        self.ensure_one()
        service = self.env['erpv6.kb.extraction.service']
        gate = self.env['erpv6.kb.validation.gate']
        self._notify_kb_extraction_start()
        try:
            entries = service.extract_kb_entries(self.file, self.file_name, notes=self.name)
            if not entries:
                self.message_post(body=_("Elaborazione KB: nessuna voce estratta dal documento."))
                self._notify_kb_extraction_result(self.env['erpv6.kb'])
                return
            created = service.create_kb_records(
                entries, source_label=f'library_document:{self.id}:{self.file_name or self.name}')
            gate.create_validation_sessions(created)
            names = ", ".join(created.mapped('name'))
            self.message_post(body=_(
                "Elaborazione KB completata: %(count)d voci create (inattive, in validazione) — %(names)s"
            ) % {'count': len(created), 'names': names})
            self._notify_kb_extraction_result(created)
        except Exception as e:
            _logger.exception("Elaborazione KB fallita per documento #%s", self.id)
            error_text = str(e)
            advice = self._kb_extraction_failure_advice(error_text)
            self.message_post(body=_(
                "Elaborazione KB fallita: %(error)s\n\nSuggerimento: %(advice)s"
            ) % {'error': error_text, 'advice': advice})
            self._notify_kb_extraction_result(self.env['erpv6.kb'], error=error_text, advice=advice)

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
        (estrazione rapida, stima non significativa)."""
        self.ensure_one()
        try:
            plan = self.env['erpv6.kb.extraction.service'].estimate_extraction_plan(self.file, self.file_name)
        except Exception:
            return
        if plan['chunk_count'] <= 1:
            return
        minutes = plan['estimated_seconds'] / 60.0
        self.message_post(body=_(
            "Elaborazione KB avviata: documento diviso in %(count)d blocchi per rispettare il "
            "limite gratuito Groq (8000 token/minuto) — tempo stimato ~%(minutes).0f minuti, "
            "elaborazione sincrona."
        ) % {'count': plan['chunk_count'], 'minutes': minutes})

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
