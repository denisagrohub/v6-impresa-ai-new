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

    # context_data (erpv6_validation, generico) e' un campo Json -- nella
    # scheda si vede come editor di codice grezzo, non testo leggibile
    # (segnalato dal vivo dall'utente: "non vedo i dati estratti"). Questi
    # campi correlati mostrano il contenuto vero della voce KB in chiaro,
    # senza toccare context_data (che resta generico, usato anche dalle
    # sessioni res_model='erpv6.production.order').
    kb_id = fields.Many2one('erpv6.kb', string='Voce KB', compute='_compute_kb_id')
    kb_content_display = fields.Text(related='kb_id.content', string='Contenuto KB', readonly=True)
    kb_category_display = fields.Char(related='kb_id.category_id.name', string='Categoria KB (attuale)', readonly=True)

    def _get_analyst_prompt_template(self):
        """Sovrascrive il default hardcoded di erpv6_validation (motore
        generico, non dipende da erpv6_kb) leggendo il prompt da una voce KB
        dedicata (kb_type='prompt', vedi data/kb_prompt_data.xml) -- modificabile
        da un utente senza toccare codice. Ritorna (template, riferimento) con
        l'id della voce KB usata, tracciato sul round e riportato nel
        certificato (vedi _build_kb_validation_certificate_data). Torna al
        default del motore se la voce non esiste ancora (modulo non
        aggiornato) o e' stata svuotata."""
        kb = self.env.ref('erpv6_production.kb_prompt_validation_analyst', raise_if_not_found=False)
        if kb and kb.content:
            return kb.content, _("KB #%(id)d - %(name)s") % {'id': kb.id, 'name': kb.name}
        return super()._get_analyst_prompt_template()

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
        impraticabile). Il certificato NON viene generato una volta a
        sessione (spammerebbe il supervisore di email su un batch grande),
        ma una volta per CATEGORIA KB coinvolta in questa chiamata (vedi
        _send_kb_validation_certificates_by_category sotto), dopo aver
        processato tutte le sessioni."""
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

        if approved_kbs:
            try:
                self._send_kb_validation_certificates_by_category(approved_kbs, session_by_kb_id)
            except Exception:
                # Stesso principio di _notify_kb_extraction_result
                # (library_document.py, commit 63f9659): un problema nella
                # generazione/invio del certificato NON deve far sembrare
                # fallita un'approvazione riuscita -- le KB sono gia' attive
                # sopra, il certificato e' un resoconto, non un gate.
                _logger.exception(
                    "Generazione/invio certificati validazione fallita per il batch approvato ora, non bloccante.")

    def _send_kb_validation_certificates_by_category(self, kbs, session_by_kb_id):
        """Un certificato Typst per CATEGORIA KB coinvolta in questo batch di
        approvazione, non uno per singola voce -- raggruppa per la categoria
        REALE appena assegnata sopra (non quella di transito, gia' uscita).
        Invia (notifica in-app + email, erpv6.typst.document.action_notify_user,
        stesso pattern del resoconto estrazione KB) a tutti i primi revisori
        e al supervisore coinvolti nelle voci di quella categoria in questo
        batch. Documento interno (mai client-facing), nessuna certificazione
        blockchain (vedi CLAUDE.md, regola pipeline documenti: blockchain
        solo per documenti esterni)."""
        template = self.env.ref(
            'erpv6_typst.typst_template_kb_validation_certificate', raise_if_not_found=False)
        if not template:
            _logger.warning("Template Typst certificato validazione non trovato — certificati non generati.")
            return

        by_category = {}
        for kb in kbs:
            by_category.setdefault(kb.category_id, self.env['erpv6.kb'])
            by_category[kb.category_id] |= kb

        for category, category_kbs in by_category.items():
            typst_doc = self.env['erpv6.typst.engine'].generate_document(
                template.id, 'erpv6.kb.category', category.id,
                data=self._build_kb_validation_certificate_data(category, category_kbs, session_by_kb_id),
            )
            if typst_doc.status != 'ready':
                _logger.warning(
                    "Rendering certificato validazione fallito per categoria #%s (typst doc #%s): %s",
                    category.id, typst_doc.id, typst_doc.error_message,
                )
                continue

            recipients = self.env['res.users']
            for kb in category_kbs:
                session = session_by_kb_id.get(kb.id)
                if session:
                    recipients |= session.human_reviewer_id | session.kb_supervisor_id
            for user in recipients:
                typst_doc.action_notify_user(user)

    def _build_kb_validation_certificate_data(self, category, kbs, session_by_kb_id):
        """Dati reali (nessun valore inventato) per il template Typst del
        certificato: una riga per voce KB (findings per-analista NON inclusi
        qui, sarebbero illeggibili su un batch di decine di voci -- restano
        comunque consultabili per singola voce nella sessione stessa, vedi
        kb_content_display/round_ids sulla vista form). Stesso principio gia'
        seguito in library_document.py._build_kb_extraction_report_data."""
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
                'rounds_count': len(session.round_ids) if session else 0,
                'final_issues_found': last_round.issues_found if last_round else 0,
                'providers_used': providers_used or '-',
                'analyst_prompt_ref': last_round.analyst_prompt_ref if last_round else '',
                'sesto_prompt_ref': last_round.sesto_prompt_ref if last_round else '',
                'first_reviewer': session.human_reviewer_id.name if session and session.human_reviewer_id else '',
                'first_reviewed_at': (
                    fields.Datetime.to_string(session.human_reviewed_at)
                    if session and session.human_reviewed_at else ''
                ),
            })
        return {
            'category_name': category.name,
            'entries_count': len(kbs),
            'entries': entries,
            'supervisor': self.env.user.name,
            'supervisor_approved_at': fields.Datetime.to_string(fields.Datetime.now()),
            'generated_at': fields.Datetime.to_string(fields.Datetime.now()),
        }
