import logging

from odoo import api, fields, models

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

    event_ids = fields.One2many('erpv6.production.event', 'order_id', string='Eventi')
    schedule_ids = fields.One2many('erpv6.production.schedule', 'order_id', string='Pianificazione Risorse')

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

    def _notify_stall(self, summary):
        """Crea un'activity Odoo (visibile in Attivita'/Discuss, non solo
        nel log eventi dell'ordine) quando la produzione resta bloccata o
        va in errore - cosi' un admin/consulente lo vede anche senza aprire
        l'ordine. Non duplica se esiste gia' un'activity aperta identica,
        per non spammare ad ogni tick del cron (ogni 30 min)."""
        self.ensure_one()
        activity_type = self.env.ref('mail.mail_activity_data_todo', raise_if_not_found=False)
        if not activity_type:
            return
        existing = self.env['mail.activity'].search([
            ('res_model', '=', self._name),
            ('res_id', '=', self.id),
            ('activity_type_id', '=', activity_type.id),
            ('summary', '=', summary),
        ], limit=1)
        if existing:
            return
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=summary,
            note=summary,
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
            self._notify_stall(f"Fase '{phase.name}' senza template Typst configurato — produzione #{self.id} bloccata.")
            return False

        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            phase.typst_template_id.id,
            'erpv6.production.order',
            self.id,
            data=self._build_typst_data(),
        )
        library_doc = self.env['erpv6.library.document'].register_document(
            project_id=self.lead_id.id,
            name=f"{phase.name} - {self.lead_id.name or self.name}",
            category=phase.output_category,
            origin='generated',
            source_model='erpv6.production.order',
            source_res_id=self.id,
            is_final=(phase.output_category == 'final'),
        )
        self.env['erpv6.production.event'].create({
            'order_id': self.id,
            'event_type': 'documento_generato',
            'decision_method': 'deterministico',
            'description': f"Documento generato per fase '{phase.name}' (typst doc #{typst_doc.id})",
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
                order._notify_stall(f"Errore durante evaluate_and_advance su produzione #{order.id} — vedi log server Odoo.")

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

        if phase.requires_output:
            existing_doc = order.document_ids.filtered(lambda d: d.category == phase.output_category)
            if not existing_doc:
                generated = order._generate_phase_output(phase)
                if not generated:
                    return

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
                    f"Validazione fase '{phase.name}' escalata a revisione umana (max_rounds superato) — "
                    f"produzione #{order.id} in attesa di action_human_approve/reject."
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
            order._notify_stall(f"Nessuna KB 'metodo_v6' risolvibile per produzione #{order.id} (verticale '{order.verticale or 'generico'}').")
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

        vals = dict(event_vals or {})
        vals.setdefault('event_type', event_type)
        vals.setdefault('decision_method', 'deterministico')
        vals.setdefault('description', 'Avanzamento automatico valutato da evaluate_and_advance')
        order.advance_phase(next_phase.id, event_vals=vals)

    def action_consultant_advance(self):
        self.ensure_one()
        return self.evaluate_and_advance(trigger='consultant')

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
