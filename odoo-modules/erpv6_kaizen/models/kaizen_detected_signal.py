from datetime import timedelta

from odoo import _, api, fields, models

# Ancora fissa per il backlog Pareto CONDIVISO tra tutte le classi di
# problema rilevate (non un record reale: res_id=0 non esiste mai su nessun
# modello Odoo, e' un "singleton" convenzionale per l'aggregato). Un item per
# record (uno per ciascuna delle 162 sessioni bloccate, es.) rendeva ogni
# analisi un'analisi con un solo elemento -- lo stesso limite gia' notato
# sulla sessione #91: con un solo item, cumulata_pct=100% e is_priority e'
# sempre falso, quindi Pareto non poteva mai confrontare le classi di
# problema tra loro. Qui invece un item per CLASSE di problema (non per
# istanza), con frequenza aggiornata ad ogni giro del cron -- coerente con la
# tassonomia sprechi della regola Kaizen #10 (KB #308).
KAIZEN_SHARED_BACKLOG = ('erpv6.kaizen.detected_signal', 0)

# Soglia oltre la quale un caso studio fermo in attesa di decisione umana
# diventa un segnale Kaizen (vedi _detect_case_study_stalled). 24h perche' i
# casi reali osservati (documenti #27/#33, 20/08/2026) erano gia' fermi da un
# giorno pieno quando scoperti manualmente -- un'attivita' to-do puo' essere
# marcata "completata" senza che la decisione sottostante sia mai stata presa
# (visto dal vivo sul documento #33), quindi non ci si puo' fidare della sola
# presenza/assenza dell'attivita' per sapere se serve ancora attenzione.
CASE_STUDY_STALLED_HOURS = 24

# Soglie per i due nuovi domini aperti il 24/08/2026 (richiesto
# esplicitamente da Denis: "apri i domini di controllo di Kaizen, sì
# quelli [bozze Typst] ed anche il log [Claudio/Argus]"). Nessun testo
# libero interrogato per il "log": stesso principio non negoziabile gia'
# in _cron_detect_signals ("zero rischio di classificazione fragile su
# testo libero") - si guarda lo stato STRUTTURATO delle proposte di
# Claudio/Argus (accepted da troppo senza mai diventare actioned), non il
# contenuto testuale del registro.
CLAUDIO_ARGUS_PROPOSAL_STUCK_HOURS = 2

# Prefisso condiviso per i signal_key generati da una segnalazione manuale
# (erpv6.kaizen.manual_report._create_detected_signal, kaizen_manual_report.py)
# -- include SEMPRE l'id della segnalazione (mai un solo 'manual_report'
# fisso): una segnalazione manuale e' per costruzione un evento singolo, non
# una classe ripetibile come 'validation_recovered_N', quindi la chiave deve
# essere unica per segnalazione fin da subito, non solo quando si ripete.
# Usato sia per il dispatch della Regola 4 sia per il filtro del cron di
# valutazione a 12 regole (kaizen_rule_engine.py, RULE4_LIVE_CHECK_HANDLER_NAMES
# + questo prefisso = l'intera "famiglia" coperta da quel motore).
MANUAL_REPORT_SIGNAL_PREFIX = 'manual_report_'


class Erpv6KaizenDetectedSignal(models.Model):
    """Registro dei segnali gia' rilevati dal cron Kaizen, per record
    monitorato (res_model/res_id, stesso idioma generico gia' usato da tutti
    i motori di erpv6_methodology). Serve solo a evitare il doppio conteggio:
    senza questo registro, una sessione bloccata per 3 ore diventerebbe "12
    eventi gravi" invece di 1, perche' il cron gira ogni 30 minuti e la
    ritroverebbe identica ad ogni giro."""
    _name = 'erpv6.kaizen.detected_signal'
    _description = 'Segnale gia\' rilevato dal cron Kaizen (evita doppio conteggio)'

    res_model = fields.Char(required=True, index=True)
    res_id = fields.Integer(required=True, index=True)
    signal_key = fields.Char(
        required=True, index=True,
        help="Identificatore stabile della condizione rilevata (es. "
             "'validation_escalation_stuck'). Le condizioni ripetibili nel tempo "
             "(es. un recupero dopo N retry) includono N nella chiave: un nuovo "
             "episodio con un N diverso genera una chiave diversa, quindi viene "
             "registrato di nuovo invece di essere scartato come duplicato."
    )
    detected_at = fields.Datetime(default=fields.Datetime.now)
    origin = fields.Selection([
        ('sensore_automatico', 'Sensore Automatico'),
        ('segnalazione_manuale', 'Segnalazione Manuale'),
    ], string='Origine', default='sensore_automatico', required=True, index=True,
        help="Distingue un segnale trovato da un cron di rilevamento (_cron_detect_signals e "
             "affini, o il futuro sensore 'copertura grafo') da uno generato da una segnalazione "
             "umana (erpv6.kaizen.manual_report) -- aggiunto il 22/08/2026 su richiesta esplicita: "
             "le segnalazioni manuali devono seguire ESATTAMENTE lo stesso ciclo delle 12 Regole, "
             "distinguibili solo per provenienza, mai un ciclo parallelo.")
    manual_report_id = fields.Many2one(
        'erpv6.kaizen.manual_report', string='Segnalazione Manuale di Origine', readonly=True, copy=False,
        help="Valorizzato solo quando origin='segnalazione_manuale': la segnalazione umana che ha "
             "generato questo segnale (vedi erpv6.kaizen.manual_report._create_detected_signal). "
             "Usato dalla Regola 4 del motore (kaizen_rule_engine.py) per riverificare dal vivo il "
             "contenuto originale, mai riassunto/reinterpretato.")

    _sql_constraints = [
        ('uniq_signal', 'UNIQUE(res_model, res_id, signal_key)',
         'Questo segnale è già stato registrato per questo record.'),
    ]

    def _already_detected(self, res_model, res_id, signal_key):
        return bool(self.search_count([
            ('res_model', '=', res_model),
            ('res_id', '=', res_id),
            ('signal_key', '=', signal_key),
        ]))

    def _mark_detected(self, res_model, res_id, signal_key):
        self.create({'res_model': res_model, 'res_id': res_id, 'signal_key': signal_key})

    def _log_shared_backlog_class(self, name, count, impatto):
        """Aggiorna (mai duplica: log_item fa get-or-create sul 'name') un
        item del backlog Pareto condiviso rappresentando un'INTERA classe di
        problema, non la singola istanza -- vedi KAIZEN_SHARED_BACKLOG sopra.
        Chiamata una volta per classe ad ogni giro del cron, quindi la
        frequenza resta sempre il conteggio attuale, non cresce all'infinito."""
        if count <= 0:
            return
        self.env['erpv6.pareto.analysis'].log_item(
            KAIZEN_SHARED_BACKLOG[0], KAIZEN_SHARED_BACKLOG[1],
            name=name, frequenza=min(count, 5), impatto=impatto,
        )

    @api.model
    def _cron_detect_signals(self):
        """Rileva SOLO da campi gia' strutturati nel database -- questa
        istanza Odoo non scrive gli errori in una tabella (nessun --log-db),
        quindi non c'e' testo di log da interrogare, per scelta esplicita del
        20/08/2026 (meno copertura, zero rischio di classificazione fragile
        su testo libero). Scrive esclusivamente record di analisi tramite
        erpv6.heinrich.indicator.log_signal / erpv6.pareto.analysis.log_item
        -- non modifica MAI lo stato dei record che monitora, non ripara
        nulla: e' il sensore, non l'autofix (tenuto deliberatamente separato,
        da progettare in un'altra sessione). Ogni _detect_* ritorna il numero
        di segnali NUOVI trovati in questo giro (0 se nulla di nuovo): se la
        somma e' > 0, scrive UNA voce di riepilogo in erpv6.kb
        (kb_type='changelog_tecnico') -- mai una voce per singola istanza
        (sarebbero 162 righe identiche sul solo caso di stasera), stesso
        principio gia' seguito per il Pareto condiviso per classe."""
        new_counts = {
            'validation_escalation_stuck': self._detect_validation_escalations_stuck(),
            'validation_recovered': self._detect_validation_recovered_after_retry(),
            'kb_extraction_stuck': self._detect_kb_extraction_stuck(),
            'kb_extraction_recovered': self._detect_kb_extraction_recovered_after_retry(),
            'case_study_stalled': self._detect_case_study_stalled(),
            'typst_draft_not_compiling': self._detect_typst_draft_not_compiling(),
            'claudio_argus_proposal_stuck': self._detect_claudio_argus_proposal_stuck(),
            'frontend_error': self._detect_frontend_errors(),
        }
        if any(new_counts.values()):
            self._log_changelog_summary(new_counts)

    def _log_changelog_summary(self, new_counts):
        """Una voce erpv6.kb (kb_type='changelog_tecnico', stessa categoria
        gia' usata per il changelog scritto a mano il 20/08/2026, vedi KB
        #290) con cosa e' cambiato in questo giro + lo snapshot Pareto
        condiviso attuale -- cosi' il changelog tecnico si aggiorna da solo
        ad ogni giro cron, non solo quando qualcuno se ne ricorda a fine
        sessione."""
        category = self.env['erpv6.kb.category'].get_or_create(
            'Changelog Tecnico', 'changelog_tecnico', is_transversal=True)
        lines = [
            "**Rilevamento automatico Kaizen** (%s)" % fields.Datetime.now(),
            "",
            "Nuovi segnali trovati in questo giro (non ridondanti con giri precedenti):",
        ]
        labels = {
            'validation_escalation_stuck': "sessioni di validazione appena bloccate in escalation umana",
            'validation_recovered': "sessioni di validazione recuperate da sole dopo retry",
            'kb_extraction_stuck': "estrazioni KB appena bloccate oltre il tetto di retry",
            'kb_extraction_recovered': "estrazioni KB recuperate da sole dopo retry",
            'case_study_stalled': "casi studio fermi da oltre %dh senza decisione umana" % CASE_STUDY_STALLED_HOURS,
            'typst_draft_not_compiling': "bozze Typst AI che non compilano",
            'claudio_argus_proposal_stuck': "proposte di Claudio/Argus approvate ma mai attuate",
            'frontend_error': "errori JavaScript reali catturati nel browser",
        }
        for key, count in new_counts.items():
            if count:
                lines.append("- %d nuove %s" % (count, labels[key]))
        backlog = self.env['erpv6.pareto.analysis'].search([
            ('res_model', '=', KAIZEN_SHARED_BACKLOG[0]), ('res_id', '=', KAIZEN_SHARED_BACKLOG[1]),
        ], limit=1)
        if backlog:
            lines.append("")
            lines.append("Backlog Pareto condiviso attuale:")
            for item in backlog.item_ids.sorted(key=lambda i: i.punteggio, reverse=True):
                lines.append("- %s: punteggio %d, cumulata %.1f%%%s" % (
                    item.name, item.punteggio, item.cumulata_pct,
                    " (PRIORITARIO)" if item.is_priority else ""))
        self.env['erpv6.kb'].create({
            # Timestamp (non solo data) nel nome: erpv6.kb ha un vincolo
            # unique su (name, kb_type) -- con la sola data, un secondo giro
            # di cron con novita' nello stesso giorno avrebbe fatto fallire
            # la create() con UniqueViolation, scoperto testando stasera.
            'name': "Kaizen - rilevamento automatico %s" % fields.Datetime.now(),
            'kb_type': 'changelog_tecnico',
            'category_id': category.id,
            'content': "\n".join(lines),
            'content_format': 'markdown',
            'access_level': 'admin',
            'is_active': True,
        })

    @api.model
    def _cron_daily_digest(self):
        """Resoconto giornaliero, una volta al giorno: raccoglie le voci
        changelog_tecnico scritte da _log_changelog_summary nelle ultime 24
        ore + lo snapshot Pareto condiviso attuale + i totali Heinrich
        aggregati su tutto il sistema. Inviato SEMPRE, anche nei giorni senza
        novita' (versione breve): il silenzio deve segnalare "il cron si e'
        fermato", non "va tutto bene" -- deciso il 20/08/2026 dopo che il
        cron di rilevamento aveva gia' scritto in silenzio una voce che
        nessuno guardava. Salva una propria voce erpv6.kb (distinta da
        quelle per-evento) e la invia (email/in-app via message_notify,
        stesso canale gia' verificato funzionante per i certificati di
        validazione) al supervisore KB -- stesso resolver gia' usato dal
        secondo gate di validazione, non un secondo modo di decidere chi e'
        responsabile."""
        since = fields.Datetime.now() - timedelta(hours=24)
        todays_entries = self.env['erpv6.kb'].search([
            ('kb_type', '=', 'changelog_tecnico'),
            ('name', 'like', 'Kaizen - rilevamento automatico%'),
            ('create_date', '>=', since),
        ], order='create_date')

        lines = ["**Resoconto giornaliero Kaizen** - %s" % fields.Date.context_today(self), ""]
        if todays_entries:
            lines.append(_("%d rilevamento/i nelle ultime 24 ore:") % len(todays_entries))
            for entry in todays_entries:
                lines.append("")
                lines.append("---")
                lines.append(entry.content)
        else:
            lines.append(_("Nessun segnale nuovo nelle ultime 24 ore."))

        backlog = self.env['erpv6.pareto.analysis'].search([
            ('res_model', '=', KAIZEN_SHARED_BACKLOG[0]), ('res_id', '=', KAIZEN_SHARED_BACKLOG[1]),
        ], limit=1)
        lines.append("")
        lines.append(_("**Backlog Pareto condiviso attuale**:"))
        if backlog and backlog.item_ids:
            for item in backlog.item_ids.sorted(key=lambda i: i.punteggio, reverse=True):
                lines.append("- %s: punteggio %d, cumulata %.1f%%%s" % (
                    item.name, item.punteggio, item.cumulata_pct,
                    " (PRIORITARIO)" if item.is_priority else ""))
        else:
            lines.append(_("(vuoto)"))

        heinrich_all = self.env['erpv6.heinrich.indicator'].search([])
        lines.append("")
        lines.append(_(
            "**Heinrich aggregato**: %(grave)d eventi gravi, %(lieve)d lievi, %(near_miss)d "
            "near-miss su %(n)d record monitorati."
        ) % {
            'grave': sum(heinrich_all.mapped('eventi_gravi')),
            'lieve': sum(heinrich_all.mapped('problemi_lievi')),
            'near_miss': sum(heinrich_all.mapped('near_miss_segnalati')),
            'n': len(heinrich_all),
        })

        content = "\n".join(lines)
        category = self.env['erpv6.kb.category'].get_or_create(
            'Changelog Tecnico', 'changelog_tecnico', is_transversal=True)
        digest_name = "Kaizen - resoconto giornaliero %s" % fields.Date.context_today(self)
        # get-or-create sul nome (a differenza del log per-evento sopra,
        # qui UN resoconto al giorno e' proprio l'obiettivo): un doppio
        # trigger dello stesso giorno (manuale/test o un ipotetico doppio
        # giro del cron) aggiorna la voce esistente invece di fallire sul
        # vincolo unique (name, kb_type) di erpv6.kb -- stesso vincolo che
        # ha fatto fallire la prima versione di questo metodo in test.
        digest_entry = self.env['erpv6.kb'].search([
            ('name', '=', digest_name), ('kb_type', '=', 'changelog_tecnico'),
        ], limit=1)
        if digest_entry:
            digest_entry.write({'content': content})
        else:
            digest_entry = self.env['erpv6.kb'].create({
                'name': digest_name,
                'kb_type': 'changelog_tecnico',
                'category_id': category.id,
                'content': content,
                'content_format': 'markdown',
                'access_level': 'admin',
                'is_active': True,
            })

        supervisor = digest_entry._resolve_kb_supervisor()
        if supervisor and supervisor.email:
            # Stesso fix gia' applicato in erpv6_typst/models/typst_document.py
            # (action_notify_user): senza email_from esplicito, mail.mail
            # risolve il mittente da self.env.user al momento dell'invio --
            # per un cron gira come OdooBot, quindi l'email arriva da
            # "OdooBot <odoobot@example.com>" invece del mittente aziendale
            # (noreply@v6impresa.it) configurato in mail.default.from.
            mail_values = {
                'subject': digest_entry.name,
                'body_html': content.replace("\n", "<br/>"),
                'email_to': supervisor.email,
            }
            default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from')
            if default_from:
                mail_values['email_from'] = '"%s" <%s>' % (self.env.company.name, default_from)
            self.env['mail.mail'].sudo().create(mail_values).send()
            # Solo nota interna nel chatter, SENZA partner_ids: passare
            # partner_ids a message_post attiva anche la notifica standard di
            # Odoo (un'altra email, di nuovo dal mittente sbagliato perche'
            # non passa da mail.default.from) -- scoperto testando stasera,
            # duplicava l'invio appena fatto sopra con mail.mail diretto.
            digest_entry.message_post(
                body=_("Resoconto inviato via email a %s.") % supervisor.name,
            )

    def _detect_validation_escalations_stuck(self):
        # Stesso valore di VALIDATION_MAX_AI_FAILURE_RETRIES in
        # erpv6_validation/models/validation_session.py -- duplicato qui (non
        # importato) per lo stesso motivo gia' seguito per CASE_STUDY_WORK_TYPES
        # in erpv6_production/models/library_document.py: non far dipendere
        # questo modulo da un dettaglio interno di un altro solo per una
        # costante. Se cambia la' va aggiornata anche qui a mano.
        VALIDATION_MAX_AI_FAILURE_RETRIES = 5
        candidates = self.env['erpv6.validation.session'].search([
            ('status', '=', 'escalated_to_human'),
            ('ai_failure_retry_count', '>=', VALIDATION_MAX_AI_FAILURE_RETRIES),
        ])
        # Ristretto il 24/08/2026 (decisione con Denis): questo segnale deve
        # restare SOLO tecnico -- se lo storico ha accumulato retry per
        # fallimenti AI ma l'ultimo round e' un disaccordo di contenuto vero
        # (last_round.is_ai_failure=False), non e' un problema sistemico per
        # Kaizen, e' una decisione per Denis (vedi content_flag su
        # erpv6.validation.session e la vista "Da decidere").
        stuck = candidates.filtered(lambda s: s.round_ids and s.round_ids[-1].is_ai_failure)
        new_count = 0
        for session in stuck:
            if self._already_detected(session._name, session.id, 'validation_escalation_stuck'):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                session._name, session.id, 'grave',
                description=_(
                    "Sessione di validazione #%(id)s bloccata in escalation umana oltre il tetto "
                    "di retry automatico (%(n)s tentativi): nessun progresso possibile senza "
                    "intervento manuale (bottone 'Valida')."
                ) % {'id': session.id, 'n': session.ai_failure_retry_count},
            )
            self._mark_detected(session._name, session.id, 'validation_escalation_stuck')
            new_count += 1
        self._log_shared_backlog_class(
            _("Sessioni di validazione bloccate in escalation umana"), len(stuck), impatto=5)
        return new_count

    def _detect_validation_recovered_after_retry(self):
        recovered = self.env['erpv6.validation.session'].search([
            ('status', 'not in', ['escalated_to_human', 'draft', 'in_validation']),
            ('ai_failure_retry_count', '>', 0),
        ])
        new_count = 0
        for session in recovered:
            signal_key = 'validation_recovered_%s' % session.ai_failure_retry_count
            if self._already_detected(session._name, session.id, signal_key):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                session._name, session.id, 'lieve',
                description=_(
                    "Sessione di validazione #%(id)s recuperata da sola dopo %(n)s retry "
                    "automatici per fallimento tecnico AI: nessun blocco permanente, ma tempo "
                    "e chiamate AI spesi."
                ) % {'id': session.id, 'n': session.ai_failure_retry_count},
            )
            self._mark_detected(session._name, session.id, signal_key)
            new_count += 1
        return new_count

    def _detect_kb_extraction_stuck(self):
        # Stesso valore di KB_EXTRACTION_MAX_AUTO_RETRIES in
        # erpv6_production/models/library_document.py -- duplicato qui per lo
        # stesso motivo del commento sopra.
        KB_EXTRACTION_MAX_AUTO_RETRIES = 5
        stuck = self.env['erpv6.library.document'].search([
            ('kb_extraction_needs_retry', '=', True),
            ('kb_extraction_retry_count', '>=', KB_EXTRACTION_MAX_AUTO_RETRIES),
        ])
        new_count = 0
        for document in stuck:
            if self._already_detected(document._name, document.id, 'kb_extraction_stuck'):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                document._name, document.id, 'grave',
                description=_(
                    "Estrazione KB del documento #%(id)s '%(name)s' bloccata oltre il tetto di "
                    "retry automatico (%(n)s tentativi): serve un rilancio manuale."
                ) % {'id': document.id, 'name': document.name, 'n': document.kb_extraction_retry_count},
            )
            self._mark_detected(document._name, document.id, 'kb_extraction_stuck')
            new_count += 1
        self._log_shared_backlog_class(
            _("Estrazioni KB bloccate oltre il tetto di retry"), len(stuck), impatto=5)
        return new_count

    def _detect_kb_extraction_recovered_after_retry(self):
        recovered = self.env['erpv6.library.document'].search([
            ('kb_extraction_needs_retry', '=', False),
            ('kb_extraction_retry_count', '>', 0),
        ])
        new_count = 0
        for document in recovered:
            signal_key = 'kb_extraction_recovered_%s' % document.kb_extraction_retry_count
            if self._already_detected(document._name, document.id, signal_key):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                document._name, document.id, 'lieve',
                description=_(
                    "Estrazione KB del documento #%(id)s '%(name)s' recuperata da sola dopo "
                    "%(n)s retry automatici: nessun blocco permanente, ma tempo e chiamate AI "
                    "spesi."
                ) % {'id': document.id, 'name': document.name, 'n': document.kb_extraction_retry_count},
            )
            self._mark_detected(document._name, document.id, signal_key)
            new_count += 1
        return new_count

    def _detect_case_study_stalled(self):
        """Documento categoria 'kb_case_study' fermo da oltre
        CASE_STUDY_STALLED_HOURS in uno stato che aspetta ancora una
        decisione umana esplicita: 'pending' (mai nemmeno processato -- es.
        il bug del file allegato dopo create(), vedi
        erpv6_production/models/library_document.py write()) oppure
        'suggested_reuse'/'suggested_new' (l'AI ha gia' suggerito, ma
        nessuno ha mai chiamato action_confirm_reuse_existing_template /
        action_confirm_create_new_template). Guarda lo STATO REALE del
        documento, non se esiste ancora un'attivita' aperta: un'attivita'
        to-do puo' essere marcata "completata" senza che la decisione
        sottostante sia mai stata presa (visto dal vivo sul documento #33,
        20-21/08/2026), quindi la sola assenza di un'attivita' non e' prova
        che il lavoro sia stato fatto."""
        threshold = fields.Datetime.now() - timedelta(hours=CASE_STUDY_STALLED_HOURS)
        stalled = self.env['erpv6.library.document'].search([
            ('category', '=', 'kb_case_study'),
            ('case_study_match_status', 'in', ['pending', 'suggested_reuse', 'suggested_new']),
            ('create_date', '<=', threshold),
        ])
        new_count = 0
        for document in stalled:
            # La chiave include lo stato attuale: un cambio di stato (es. da
            # 'pending' a 'suggested_new' dopo un rilancio manuale che poi
            # resta comunque fermo) e' una situazione nuova, va segnalata di
            # nuovo invece di restare silenziosamente scartata come duplicato
            # del vecchio segnale su 'pending'.
            signal_key = 'case_study_stalled_%s' % document.case_study_match_status
            if self._already_detected(document._name, document.id, signal_key):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                document._name, document.id, 'lieve',
                description=_(
                    "Documento caso studio #%(id)s '%(name)s' fermo da oltre %(h)dh nello stato "
                    "'%(status)s': nessuna decisione umana (riuso template esistente / nuovo "
                    "template) ancora presa. Se esisteva un'attivita' to-do, verifica se e' "
                    "stata chiusa senza eseguire l'azione corrispondente."
                ) % {
                    'id': document.id, 'name': document.name, 'h': CASE_STUDY_STALLED_HOURS,
                    'status': document.case_study_match_status,
                },
            )
            self._mark_detected(document._name, document.id, signal_key)
            new_count += 1
        self._log_shared_backlog_class(
            _("Casi studio fermi senza decisione umana"), len(stalled), impatto=3)
        return new_count

    def _detect_typst_draft_not_compiling(self):
        """Dominio aperto il 24/08/2026 (gia' segnalato come buco reale il
        24/08/2026 dopo aver letto il sensore: "Kaizen NON vede bozze
        Typst che non compilano"). Template con una bozza AI generata
        (typst_source_draft valorizzato) ma typst_draft_compile_ok=False -
        oggi scopribile solo aprendo il template a mano."""
        broken = self.env['erpv6.typst.template'].search([
            ('typst_source_draft', '!=', False),
            ('typst_draft_compile_ok', '=', False),
        ])
        new_count = 0
        for template in broken:
            signal_key = 'typst_draft_not_compiling'
            if self._already_detected(template._name, template.id, signal_key):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                template._name, template.id, 'lieve',
                description=_(
                    "Template Typst #%(id)s '%(name)s': la bozza AI generata non compila "
                    "(typst_draft_compile_ok=False). Errore reale: %(err)s"
                ) % {'id': template.id, 'name': template.name,
                     'err': (template.typst_draft_compile_error or '')[:300]},
            )
            self._mark_detected(template._name, template.id, signal_key)
            new_count += 1
        self._log_shared_backlog_class(
            _("Bozze Typst AI che non compilano"), len(broken), impatto=3)
        return new_count

    def _detect_claudio_argus_proposal_stuck(self):
        """Dominio aperto il 24/08/2026. SOLO stato strutturato (status,
        create_date), MAI il contenuto testuale del registro Claudio/Argus
        - stesso principio non negoziabile di _cron_detect_signals. Una
        proposta di Claudio/Argus 'accepted' da piu' di
        CLAUDIO_ARGUS_PROPOSAL_STUCK_HOURS senza mai diventare 'actioned'
        significa che il ciclo automatico (watch_proposals.py) non l'ha
        presa in carico o e' bloccato - va segnalato, non lasciato
        silenzioso in coda per sempre."""
        threshold = fields.Datetime.now() - timedelta(hours=CLAUDIO_ARGUS_PROPOSAL_STUCK_HOURS)
        stuck = self.env['erpv6.agent.proposal'].search([
            ('agent_config_id.code', 'in', ['claudio', 'argus']),
            ('status', '=', 'accepted'),
            ('reviewed_at', '<=', threshold),
        ])
        new_count = 0
        for proposal in stuck:
            signal_key = 'claudio_argus_proposal_stuck'
            if self._already_detected(proposal._name, proposal.id, signal_key):
                continue
            self.env['erpv6.heinrich.indicator'].log_signal(
                proposal._name, proposal.id, 'lieve',
                description=_(
                    "Proposta #%(id)s ('%(name)s') di %(agent)s approvata da oltre %(h)dh ma mai "
                    "diventata 'attuata' - il ciclo automatico potrebbe non averla presa in "
                    "carico (processo fermo?) o essere bloccato su un errore."
                ) % {'id': proposal.id, 'name': proposal.name, 'agent': proposal.agent_config_id.name,
                     'h': CLAUDIO_ARGUS_PROPOSAL_STUCK_HOURS},
            )
            self._mark_detected(proposal._name, proposal.id, signal_key)
            new_count += 1
        self._log_shared_backlog_class(
            _("Proposte di Claudio/Argus approvate ma mai attuate"), len(stuck), impatto=4)
        return new_count

    def _detect_frontend_errors(self):
        """Dominio aperto il 24/08/2026 (richiesto esplicitamente: "se apro
        una pagina e appare un errore"). Legge SOLO i campi strutturati di
        erpv6.frontend.error (message/url), mai testo libero di log
        server - il dato arriva gia' strutturato dal browser tramite
        erpv6_core/static/src/js/error_reporter.js + l'endpoint pubblico
        dedicato, stesso principio non negoziabile del resto del sensore."""
        if 'erpv6.frontend.error' not in self.env:
            return 0
        errors = self.env['erpv6.frontend.error'].search([], limit=50, order='occurred_at desc')
        new_count = 0
        found_grave = False
        for error in errors:
            signal_key = 'frontend_error'
            if self._already_detected(error._name, error.id, signal_key):
                continue
            # Severita' su 'blocking' (24/08/2026, richiesto esplicitamente
            # da Denis: "un problema che mi blocca l'accesso ad una pagina
            # non e' un near miss") - campo strutturato calcolato lato
            # client su error.name === 'OwlError' (vedi error_reporter.js),
            # mai dedotto qui dal testo del messaggio.
            severity = 'grave' if error.blocking else 'near_miss'
            found_grave = found_grave or error.blocking
            self.env['erpv6.heinrich.indicator'].log_signal(
                error._name, error.id, severity,
                description=_(
                    "Errore JavaScript reale nel browser su %(url)s: %(msg)s"
                ) % {'url': error.url or '(pagina sconosciuta)', 'msg': error.message},
            )
            self._mark_detected(error._name, error.id, signal_key)
            new_count += 1
        self._log_shared_backlog_class(
            _("Errori JavaScript reali nel browser"), len(errors), impatto=2)
        if found_grave:
            # "Il sistema deve essere attivo, e sistemare" (24/08/2026,
            # richiesto esplicitamente da Denis): senza questo, un segnale
            # 'grave' aspetterebbe comunque il cron GIORNALIERO di
            # _cron_kaizen_agent_propose (interval=1days, indipendente dal
            # cron di rilevamento ogni 30 minuti) prima che Kaizen ne
            # scrivesse una proposta -- fino a 24h di ritardo su un
            # problema che blocca davvero una pagina. Chiamata diretta,
            # UNA sola volta per giro (non per errore), stesso limite
            # "al massimo una proposta a giro" gia' documentato li'.
            self._cron_kaizen_agent_propose()
        return new_count
