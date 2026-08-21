import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6ValidationSession(models.Model):
    _inherit = 'erpv6.validation.session'

    # Campi distinti da human_reviewer_id/human_reviewed_at (generici,
    # scritti dal PRIMO gate in action_human_approve) -- il secondo gate
    # (supervisore KB) non deve sovrascriverli, altrimenti si perde chi ha
    # fatto la prima revisione.
    kb_supervisor_id = fields.Many2one('res.users', string='Supervisore KB (secondo gate)')
    kb_supervisor_approved_at = fields.Datetime(string='Approvato dal supervisore KB il')
    # Il certificato NON viene piu' generato subito all'approvazione (vedi
    # action_supervisor_approve) ma consolidato una volta all'ora da
    # _cron_send_consolidated_kb_certificates -- segnalato dal vivo
    # dall'utente il 20/08/2026: validare in piu' click separati nella
    # stessa ora produceva piu' certificati per la stessa categoria invece
    # di uno solo. False finche' non e' stato incluso in un certificato
    # consolidato.
    certificate_sent = fields.Boolean(default=False, copy=False)

    # context_data (erpv6_validation, generico) e' un campo Json -- nella
    # scheda si vede come editor di codice grezzo, non testo leggibile
    # (segnalato dal vivo dall'utente: "non vedo i dati estratti"). Questi
    # campi correlati mostrano il contenuto vero della voce KB in chiaro,
    # senza toccare context_data (che resta generico, usato anche dalle
    # sessioni res_model='erpv6.production.order').
    kb_id = fields.Many2one('erpv6.kb', string='Voce KB', compute='_compute_kb_id')
    kb_content_display = fields.Text(related='kb_id.content', string='Contenuto KB', readonly=True)
    kb_category_display = fields.Char(related='kb_id.category_id.name', string='Categoria KB (attuale)', readonly=True)

    # 5 voci KB distinte (una per analista, vedi data/kb_prompt_data.xml),
    # non piu' una condivisa: prima tutti e 5 leggevano
    # kb_prompt_validation_analyst, stesso identico testo -- bug gemello a
    # quello gia' corretto in erpv6_validation (template risolto fuori dal
    # ciclo). Aggiunto il 21/08/2026 da un agente di verifica dedicato.
    _KB_ANALYST_PROMPT_XMLIDS = {
        '1': 'erpv6_production.kb_prompt_validation_analyst_1',
        '2': 'erpv6_production.kb_prompt_validation_analyst_2',
        '3': 'erpv6_production.kb_prompt_validation_analyst_3',
        '4': 'erpv6_production.kb_prompt_validation_analyst_4',
        '5': 'erpv6_production.kb_prompt_validation_analyst_5',
    }

    def _get_analyst_prompt_template(self, analyst_idx=None):
        """Sovrascrive il default hardcoded di erpv6_validation (motore
        generico, non dipende da erpv6_kb) leggendo il prompt da una voce KB
        dedicata PER ANALISTA (kb_type='prompt', vedi data/kb_prompt_data.xml)
        -- modificabile da un utente senza toccare codice. Ritorna (template,
        riferimento) con l'id della voce KB usata, tracciato per analista
        (erpv6.validation.analysis.prompt_ref) e riportato nel certificato
        (vedi _build_kb_validation_certificate_data). Torna al default del
        motore se la voce non esiste ancora, e' stata svuotata, o
        res_model non e' 'erpv6.kb' (le 5 lenti sono scritte esplicitamente
        per "voce KB estratta da documento", non hanno senso per sessioni
        erpv6.production.order/Typst -- prima questo override si applicava
        indiscriminatamente a QUALSIASI res_model, altro bug gemello
        corretto qui)."""
        if self.res_model == 'erpv6.kb':
            xmlid = self._KB_ANALYST_PROMPT_XMLIDS.get(analyst_idx)
            kb = self.env.ref(xmlid, raise_if_not_found=False) if xmlid else None
            if kb and kb.content:
                return kb.content, _("KB #%(id)d - %(name)s") % {'id': kb.id, 'name': kb.name}
        return super()._get_analyst_prompt_template(analyst_idx=analyst_idx)

    def _get_sesto_uomo_prompt_template(self):
        """Come sopra, per il prompt del Sesto Uomo."""
        kb = self.env.ref('erpv6_production.kb_prompt_validation_sesto_uomo', raise_if_not_found=False)
        if kb and kb.content:
            return kb.content, _("KB #%(id)d - %(name)s") % {'id': kb.id, 'name': kb.name}
        return super()._get_sesto_uomo_prompt_template()

    @api.depends('res_model', 'res_id')
    def _compute_kb_id(self):
        for session in self:
            session.kb_id = (
                self.env['erpv6.kb'].browse(session.res_id) if session.res_model == 'erpv6.kb' else False)

    def action_human_approve(self):
        """Su erpv6.kb questo e' solo il PRIMO dei due gate (vedi
        action_supervisor_approve sotto per il secondo, bloccante): il
        metodo base (erpv6_validation, generico) porta lo stato ad
        'approved' per qualunque sessione -- qui lo correggiamo subito a
        'human_reviewed' per le sole sessioni erpv6.kb, cosi' il motore
        generico non deve sapere nulla del concetto di "secondo gate" (resta
        specifico a erpv6_production/erpv6.kb, coerente col principio
        motore-vs-conoscenza). L'attivazione della KB (is_active=True +
        spostamento in categoria reale) NON avviene piu' qui ma solo in
        action_supervisor_approve."""
        result = super().action_human_approve()
        kb_sessions = self.filtered(lambda s: s.res_model == 'erpv6.kb')
        if kb_sessions:
            kb_sessions.write({'status': 'human_reviewed'})
        for session in self:
            if session.res_model == 'erpv6.production.order':
                order = self.env['erpv6.production.order'].browse(session.res_id)
                if order.exists():
                    order.evaluate_and_advance(trigger='validation_approved')
        return result

    def action_validate_kb(self):
        """Bottone unico 'Valida' per le sessioni voce KB: incatena i due
        gate esistenti (action_human_approve poi action_supervisor_approve)
        in un solo click -- segnalato dal vivo dall'utente il 20/08/2026
        provando a validare la KB #28: il flusso a due gate separati (pensato
        per revisore e supervisore come persone distinte) si e' rivelato solo
        fonte di confusione quando chi valida e' sempre la stessa persona, al
        punto che l'utente aveva provato a compilare a mano
        human_reviewer_id/human_reviewed_at (ora readonly, vedi
        erpv6_validation/views) pensando fosse quello il modo di validare --
        il form si salvava (200 OK) ma nessuna logica di approvazione veniva
        eseguita, la sessione restava ferma. I due metodi/stati sottostanti
        restano intatti (storico/audit, riusabili se revisore e supervisore
        torneranno mai a essere persone diverse): qui si limita a
        incatenarli con i controlli di ciascuno ancora attivi."""
        for session in self:
            if session.res_model != 'erpv6.kb':
                raise UserError(_("Il bottone 'Valida' si applica solo alle sessioni di validazione voce KB."))
            if session.status not in ('converged', 'escalated_to_human', 'human_reviewed'):
                raise UserError(_(
                    "Sessione #%(id)s: si può validare solo dopo la convergenza dei 6 Giudici "
                    "(o in escalation umana). Stato attuale: %(status)s."
                ) % {'id': session.id, 'status': session.status})
        to_first_gate = self.filtered(lambda s: s.status in ('converged', 'escalated_to_human'))
        if to_first_gate:
            to_first_gate.action_human_approve()
        self.action_supervisor_approve()

    def action_supervisor_approve(self):
        """Secondo gate, bloccante e finale per le voci KB: SOLO il
        supervisore KB (referente KB globale, vedi
        erpv6.kb._resolve_kb_supervisor) puo' completarlo, indipendentemente
        da chi ha fatto il primo gate (action_human_approve, chiunque abbia
        i permessi). Applicabile solo a sessioni gia' passate dal primo gate
        (status='human_reviewed'). Qui, e solo qui, la voce KB diventa
        attiva e si sposta dalla categoria di transito a quella reale
        suggerita dall'AI in estrazione (vedi KB_STAGING_CATEGORY_NAME in
        kb_extraction_service.py).

        self puo' contenere MOLTE sessioni insieme (approvazione in blocco
        dalla vista lista, vedi data/validation_session_bulk_actions.xml --
        segnalato dal vivo dall'utente: approvare 70+ voci una per una e'
        impraticabile). Il certificato NON viene generato qui (ne' una volta
        a sessione ne' una volta a chiamata): resta 'certificate_sent=False'
        e viene consolidato una volta all'ora da
        _cron_send_consolidated_kb_certificates, cosi' piu' click separati
        nella stessa ora (es. valido 5 voci ora, altre 3 tra 10 minuti)
        producono UN solo certificato per categoria invece di uno per ogni
        click -- segnalato dal vivo dall'utente il 20/08/2026."""
        approved_kbs = self.env['erpv6.kb']
        session_by_kb_id = {}
        for session in self:
            if session.res_model != 'erpv6.kb':
                raise UserError(_("L'approvazione del supervisore si applica solo alle voci KB."))
            if session.status != 'human_reviewed':
                raise UserError(_(
                    "Questa sessione deve prima superare la revisione umana di primo livello "
                    "(pulsante 'Approva')."
                ))
            kb = self.env['erpv6.kb'].browse(session.res_id)
            if not kb.exists():
                continue
            supervisor = kb._resolve_kb_supervisor()
            if supervisor and self.env.user != supervisor:
                raise UserError(_(
                    "Solo il supervisore KB assegnato (%s) può completare questa approvazione."
                ) % supervisor.name)
            session.status = 'approved'
            session.kb_supervisor_id = self.env.user
            session.kb_supervisor_approved_at = fields.Datetime.now()
            vals = {'is_active': True}
            if kb.suggested_category_name:
                # Esce dalla categoria di transito (vedi
                # KB_STAGING_CATEGORY_NAME in kb_extraction_service.py) e si
                # sposta nella categoria di business suggerita dall'AI in
                # fase di estrazione -- stessa chiave (nome, kb_type) e
                # stesso default is_transversal=True gia' usati prima
                # dell'introduzione dello staging.
                real_category = self.env['erpv6.kb.category'].get_or_create(
                    kb.suggested_category_name, kb.kb_type, is_transversal=True)
                vals['category_id'] = real_category.id
            kb.write(vals)
            approved_kbs |= kb
            session_by_kb_id[kb.id] = session
        # Il certificato si genera nel cron consolidato (vedi
        # _cron_send_consolidated_kb_certificates sotto), non qui.

    @api.model
    def _cron_send_consolidated_kb_certificates(self):
        """Consolida in UN certificato per categoria tutte le approvazioni
        KB accumulate dall'ultimo giro (un'ora, vedi data/production_cron.xml)
        -- sostituisce la generazione sincrona per-chiamata di
        action_supervisor_approve, che produceva un certificato diverso per
        ogni click separato anche entro la stessa ora (segnalato dal vivo
        dall'utente il 20/08/2026)."""
        sessions = self.search([
            ('res_model', '=', 'erpv6.kb'),
            ('status', '=', 'approved'),
            ('certificate_sent', '=', False),
        ])
        if not sessions:
            return
        approved_kbs = self.env['erpv6.kb']
        session_by_kb_id = {}
        for session in sessions:
            kb = self.env['erpv6.kb'].browse(session.res_id)
            if not kb.exists():
                continue
            approved_kbs |= kb
            session_by_kb_id[kb.id] = session
        if not approved_kbs:
            return
        try:
            self._send_kb_validation_certificates_by_category(approved_kbs, session_by_kb_id)
        except Exception:
            # Stesso principio di _notify_kb_extraction_result
            # (library_document.py, commit 63f9659): un problema nella
            # generazione/invio del certificato NON deve far sembrare
            # fallita un'approvazione riuscita -- le KB sono gia' attive,
            # il certificato e' un resoconto, non un gate. Le sessioni NON
            # vengono marcate certificate_sent qui sotto in caso di
            # eccezione, quindi il prossimo giro ritenta lo stesso batch.
            _logger.exception(
                "Generazione/invio certificati validazione consolidati fallita, ritento al prossimo giro.")
            return
        sessions.write({'certificate_sent': True})

    def _send_kb_validation_certificates_by_category(self, kbs, session_by_kb_id):
        """UN SOLO certificato Typst per l'intero batch (tutte le categorie
        insieme), non uno per categoria -- corretto il 20/08/2026 dopo che
        l'utente ha segnalato dal vivo di aver ricevuto "una email per KB"
        (in pratica una per categoria, che con voci sparse su molte
        categorie diverse degenera quasi in una per voce): "un certificato
        unico" nella richiesta originale significava UNO in assoluto, non
        raggruppato per categoria. La categoria di ciascuna voce resta
        visibile come colonna nella tabella (vedi
        _build_kb_validation_certificate_data), non e' sparita, solo non e'
        piu' il criterio di split del documento. Invia (notifica in-app +
        email, erpv6.typst.document.action_notify_user) a tutti i primi
        revisori e al supervisore coinvolti in QUALSIASI voce del batch.
        Documento interno (mai client-facing), nessuna certificazione
        blockchain (vedi CLAUDE.md, regola pipeline documenti: blockchain
        solo per documenti esterni)."""
        template = self.env.ref(
            'erpv6_typst.typst_template_kb_validation_certificate', raise_if_not_found=False)
        if not template:
            _logger.warning("Template Typst certificato validazione non trovato — certificati non generati.")
            return
        if not kbs:
            return

        # Nessun singolo record rappresenta "questo batch eterogeneo di
        # categorie": si ancora il documento generato alla prima sessione
        # del batch solo per tracciabilita' (res_model/res_id e' il pattern
        # generico gia' usato ovunque in questo modulo), non ha altro
        # significato speciale.
        anchor_session = next(iter(session_by_kb_id.values()))
        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            template.id, anchor_session._name, anchor_session.id,
            data=self._build_kb_validation_certificate_data(kbs, session_by_kb_id),
        )
        if typst_doc.status != 'ready':
            _logger.warning(
                "Rendering certificato validazione consolidato fallito (typst doc #%s): %s",
                typst_doc.id, typst_doc.error_message,
            )
            return

        recipients = self.env['res.users']
        for kb in kbs:
            session = session_by_kb_id.get(kb.id)
            if session:
                recipients |= session.human_reviewer_id | session.kb_supervisor_id
        for user in recipients:
            typst_doc.action_notify_user(user)

        # Il progetto del documento di origine deve mostrare anche l'esito
        # finale, non solo email/notifica (stesso principio del resoconto
        # pre-approvazione, vedi library_document.py._commit_kb_extraction_batch)
        # -- il batch puo' raggruppare voci nate da documenti/progetti
        # diversi, quindi si allega a TUTTI i progetti coinvolti (senza
        # duplicati).
        projects = self._resolve_projects_from_kbs(kbs)
        for project in projects:
            self.env['erpv6.library.document']._attach_typst_document_to_project(
                project, typst_doc, _("Certificato validazione 6 Giudici consolidato"))
            self.env['project.task'].sudo().create({
                'name': _("Validazione 6 Giudici completata"),
                'project_id': project.id,
                'description': _("%d voci approvate e attivate in questo giro.") % len(kbs),
            })

    def _resolve_projects_from_kbs(self, kbs):
        """Risale ai project.project di origine di un insieme di voci KB,
        parsando kb.source ('library_document:<id>:<nome>', scritto da
        kb_extraction_service.create_kb_records) -- unico collegamento oggi
        disponibile tra una voce KB e il documento/progetto da cui e'
        nata. Ritorna solo i progetti distinti e gia' esistenti (nessuna
        creazione qui: se il documento non ha ancora un progetto, es. non e'
        mai passato da _ensure_kb_project, semplicemente non c'e' nulla a
        cui allegare)."""
        projects = self.env['project.project']
        seen_document_ids = set()
        for kb in kbs:
            if not kb.source or not kb.source.startswith('library_document:'):
                continue
            try:
                document_id = int(kb.source.split(':')[1])
            except (IndexError, ValueError):
                continue
            if document_id in seen_document_ids:
                continue
            seen_document_ids.add(document_id)
            document = self.env['erpv6.library.document'].browse(document_id)
            if not document.exists():
                continue
            order = self.env['erpv6.production.order'].search(
                [('lead_id', '=', document.project_id.id)], limit=1)
            if order.project_id:
                projects |= order.project_id
        return projects

    def _build_kb_validation_certificate_data(self, kbs, session_by_kb_id):
        """Dati reali (nessun valore inventato) per il template Typst del
        certificato: una riga per voce KB, PIU' il ragionamento per-analista
        dell'ultimo round (findings di ciascuno dei 5 analisti + sintesi del
        Sesto Uomo) -- richiesto esplicitamente dall'utente il 21/08/2026
        insieme al fix dei 5 prompt differenziati, per rendere visibile nel
        certificato lo stesso ragionamento che prima restava consultabile
        solo aprendo la sessione. Solo l'ULTIMO round (non tutto lo storico
        round-per-round): e' quello che ha portato alla decisione finale,
        includere anche i round precedenti gonfierebbe il certificato senza
        aggiungere informazione decisionale.

        'supervisor'/'supervisor_approved_at' NON sono piu' self.env.user/now()
        (corretto il 20/08/2026 insieme al certificato consolidato): con la
        generazione spostata su un cron orario, self.env.user sarebbe
        l'utente tecnico del cron, non chi ha davvero approvato -- si legge
        invece kb_supervisor_id/kb_supervisor_approved_at gia' salvati su
        ciascuna sessione al momento vero dell'approvazione."""
        kb_type_labels = dict(kbs._fields['kb_type'].selection) if kbs else {}
        entries = []
        supervisors_seen = self.env['res.users']
        for kb in kbs:
            session = session_by_kb_id.get(kb.id)
            last_round = session.round_ids[-1] if session and session.round_ids else None
            providers_used = ', '.join(sorted(filter(None, set(
                last_round.analysis_ids.mapped('provider_name'))))) if last_round else ''
            if session and session.kb_supervisor_id:
                supervisors_seen |= session.kb_supervisor_id
            analyst_findings = []
            sesto_findings = ''
            if last_round:
                for analysis in last_round.analysis_ids.filtered(lambda a: a.analyst_index != 'sesto'):
                    analyst_findings.append({
                        'analyst_index': analysis.analyst_index,
                        'prompt_ref': analysis.prompt_ref or '-',
                        'findings': analysis.findings or '-',
                    })
                sesto_findings = last_round.sesto_uomo_notes or last_round.corrected_material or '-'
            entries.append({
                'kb_name': kb.name,
                'kb_type': kb_type_labels.get(kb.kb_type, kb.kb_type),
                'category': kb.category_id.name or '-',
                'rounds_count': len(session.round_ids) if session else 0,
                'final_issues_found': last_round.issues_found if last_round else 0,
                'providers_used': providers_used or '-',
                # 'or ''' non solo 'if last_round else': un campo Char vuoto
                # su un round REALE si legge come False, non '' (idioma ORM
                # Odoo) -- passato cosi' com'e' al JSON, Typst lo stampa
                # letteralmente "false" invece di lasciare vuota la cella
                # (il fallback default:"-" del template scatta solo se la
                # chiave manca, non se vale false). Visto dal vivo
                # sull'utente il 20/08/2026 sul certificato consolidato,
                # rounds vecchi creati prima che questi due campi venissero
                # tracciati.
                # Aggregato dai prompt_ref per-analista (erpv6.validation.analysis),
                # non piu' da last_round.analyst_prompt_ref (un solo Char sul
                # round, coerente quando tutti e 5 leggevano lo stesso prompt --
                # da quando sono differenziati, quel campo resta vuoto sui round
                # nuovi: vedi commento in _run_round, erpv6_validation).
                'analyst_prompt_ref': (', '.join(sorted(set(filter(
                    None, last_round.analysis_ids.filtered(lambda a: a.analyst_index != 'sesto').mapped('prompt_ref')
                )))) if last_round else '') or '',
                'sesto_prompt_ref': (last_round.sesto_prompt_ref or '') if last_round else '',
                'analyst_findings': analyst_findings,
                'sesto_findings': sesto_findings,
                'first_reviewer': session.human_reviewer_id.name if session and session.human_reviewer_id else '',
                'first_reviewed_at': (
                    fields.Datetime.to_string(session.human_reviewed_at)
                    if session and session.human_reviewed_at else ''
                ),
                'second_gate_reviewer': session.kb_supervisor_id.name if session and session.kb_supervisor_id else '',
                'second_gate_approved_at': (
                    fields.Datetime.to_string(session.kb_supervisor_approved_at)
                    if session and session.kb_supervisor_approved_at else ''
                ),
            })
        category_names = sorted(set(kbs.mapped('category_id.name')))
        return {
            'category_name': ', '.join(category_names) or '-',
            'entries_count': len(kbs),
            'entries': entries,
            'supervisor': ', '.join(supervisors_seen.mapped('name')) or '-',
            'supervisor_approved_at': fields.Datetime.to_string(fields.Datetime.now()),
            'generated_at': fields.Datetime.to_string(fields.Datetime.now()),
        }
