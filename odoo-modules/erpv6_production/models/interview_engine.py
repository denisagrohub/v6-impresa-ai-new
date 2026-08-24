import logging

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6InterviewQuestion(models.Model):
    """Nodo dell'albero d'intervista. Generico per qualunque prodotto padre
    (non solo business plan): verticale_id vuoto = domanda che si applica a
    qualunque prodotto/variante scelta come radice (es. budget/tempistiche),
    valorizzato = domanda specifica di quel prodotto generico/variante (vedi
    erpv6.vertical.catalog.parent_id, aggiunto in erpv6_saas per lo stesso
    disegno). Il ramo si naviga con parent_id/child_ids; ogni nodo mostra
    SEMPRE, a livello di frontend, un campo libero "altro" in aggiunta alle
    opzioni proposte (vedi always_show_altro) - non e' un'opzione tra le
    altre, e' un meccanismo fisso del motore."""
    _name = 'erpv6.interview.question'
    _description = "Intervista - Domanda (nodo dell'albero)"
    _inherit = ['erpv6.core.tracked']
    _order = 'sequence, id'

    name = fields.Char(string='Chiave tecnica', required=True,
                        help="Identificatore breve, es. 'tempistiche', 'obiettivi'. Non tradotto, uso interno.")
    question_text = fields.Char(string='Testo della domanda', required=True, translate=True)
    sequence = fields.Integer(default=10)
    parent_id = fields.Many2one('erpv6.interview.question', string='Domanda precedente (ramo)',
                                 ondelete='cascade')
    child_ids = fields.One2many('erpv6.interview.question', 'parent_id', string='Domande successive')
    verticale_id = fields.Many2one(
        'erpv6.vertical.catalog', string='Prodotto/variante',
        help="Vuoto = domanda generica valida per qualsiasi prodotto scelto come radice "
             "dell'intervista. Valorizzato = si applica solo a chi ha scelto questo prodotto "
             "generico o questa variante specifica.")
    field_key = fields.Char(
        string='Campo di destinazione',
        help="Se valorizzato, la risposta viene scritta su questo campo dell'intervista "
             "(erpv6.production.order via crm_lead._start_production, es. 'budget', "
             "'tempistiche', 'tipo_progetto', 'destinatario', 'fatturato'). Vuoto = risposta "
             "raccolta solo come erpv6.interview.answer, nessun campo esistente da valorizzare.")
    answer_type = fields.Selection([
        ('select', 'Scelta tra opzioni'),
        ('text', 'Testo breve'),
        ('textarea', 'Testo lungo'),
        ('number', 'Numero'),
    ], string='Tipo risposta', required=True, default='select')
    option_ids = fields.One2many('erpv6.interview.question.option', 'question_id', string='Opzioni proposte')
    always_show_altro = fields.Boolean(
        string='Mostra sempre "altro"', default=True,
        help="Il frontend deve sempre offrire un campo libero oltre alle opzioni proposte - "
             "disattivabile solo per domande a testo libero dove non avrebbe senso.")
    kb_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB collegata',
        help="Opzionale: se valorizzata, prima di mostrare questa domanda il motore cerca la KB "
             "attiva piu' pertinente in questa categoria e la propone come messaggio di contesto "
             "(vedi get_contextual_message) - il grafo/KB che 'entra in intervista mano a mano "
             "che arrivano le risposte', discusso con Denis il 22-23/08/2026.")

    def get_contextual_message(self):
        """KB piu' pertinente della categoria collegata, o False se non
        c'e' nulla (nessun messaggio fabbricato - degrada silenziosamente,
        vedi disciplina anti-allucinazione in CLAUDE.md)."""
        self.ensure_one()
        if not self.kb_category_id:
            return False
        kb = self.env['erpv6.kb'].sudo().search([
            ('category_id', '=', self.kb_category_id.id), ('is_active', '=', True),
        ], order='priority desc', limit=1)
        return kb.content if kb else False


class Erpv6InterviewQuestionOption(models.Model):
    _name = 'erpv6.interview.question.option'
    _description = 'Intervista - Opzione di risposta'
    _order = 'sequence, id'

    question_id = fields.Many2one('erpv6.interview.question', required=True, ondelete='cascade')
    value = fields.Char(string='Valore', required=True, translate=True,
                         help="Stringa esatta salvata come risposta. Se la domanda ha field_key "
                              "'budget' o 'tempistiche', deve coincidere con answer_label in "
                              "erpv6.kairos.scoring.rule, altrimenti il punteggio Kairos non "
                              "riconosce la risposta.")
    sequence = fields.Integer(default=10)


class Erpv6InterviewSession(models.Model):
    """Una sessione d'intervista per un lead. Puo' generarne piu' di una nel
    tempo (es. seconda intervista per un secondo prodotto): non c'e' vincolo
    di unicita' su lead_id."""
    _name = 'erpv6.interview.session'
    _description = 'Intervista - Sessione'
    _inherit = ['erpv6.core.tracked']

    lead_id = fields.Many2one('crm.lead', string='Lead', required=True, ondelete='cascade')
    verticale_id = fields.Many2one(
        'erpv6.vertical.catalog', string='Prodotto scelto',
        help="Prodotto generico (o variante) scelto come radice, risposta alla prima domanda "
             "'che tipo di prodotto ti interessa?'.")
    state = fields.Selection([
        ('draft', 'Da iniziare'),
        ('in_progress', 'In corso'),
        ('completed', 'Completata'),
    ], default='draft', required=True, tracking=True)
    current_question_id = fields.Many2one('erpv6.interview.question', string='Domanda corrente')
    answer_ids = fields.One2many('erpv6.interview.answer', 'session_id', string='Risposte')
    started_date = fields.Datetime(readonly=True)
    completed_date = fields.Datetime(readonly=True)
    kairos_matrix_id = fields.Many2one('erpv6.kairos.matrix', string='Matrice Kairos', readonly=True, copy=False)

    def action_start(self, verticale_id=None):
        """Avvia la sessione: sceglie la prima domanda radice pertinente
        (parent_id vuoto, verticale_id vuoto o coerente col prodotto
        scelto) ordinata per sequence. Idempotente: se gia' avviata,
        ritorna la domanda corrente senza ricominciare."""
        self.ensure_one()
        if self.state != 'draft':
            return self.current_question_id
        vals = {'state': 'in_progress', 'started_date': fields.Datetime.now()}
        if verticale_id:
            vals['verticale_id'] = verticale_id
        self.write(vals)
        first = self._find_next_question(after=None)
        self.current_question_id = first.id if first else False
        return first

    def action_answer(self, question, value_text=None, option_id=None, is_altro=False):
        """Registra una risposta alla domanda corrente e avanza. 'question'
        deve coincidere con self.current_question_id (nessuna scrittura
        fuori sequenza): protegge l'ordine dell'albero, che e' anche
        l'ordine in cui il motore Kairos/KB si aspetta i dati."""
        self.ensure_one()
        if self.state != 'in_progress':
            raise ValueError("Sessione non in corso, impossibile registrare una risposta.")
        if not question or question.id != self.current_question_id.id:
            raise ValueError("La domanda passata non e' la domanda corrente della sessione.")
        answer = self.env['erpv6.interview.answer'].create({
            'session_id': self.id,
            'question_id': question.id,
            'option_id': option_id or False,
            'value_text': value_text or False,
            'is_altro': bool(is_altro),
        })
        next_question = self._find_next_question(after=question)
        if next_question:
            self.current_question_id = next_question.id
        else:
            self.current_question_id = False
            self._complete()
        return answer, next_question

    def _find_next_question(self, after=None):
        """Cammina l'albero: se 'after' ha figli pertinenti al prodotto
        scelto, scende nel ramo; altrimenti prende il prossimo fratello non
        risposto sotto lo stesso parent; risalendo fino alla radice se
        esauriti. Nessuna domanda gia' risposta in questa sessione viene
        riproposta."""
        self.ensure_one()
        Question = self.env['erpv6.interview.question']
        answered_ids = set(self.answer_ids.mapped('question_id').ids)
        verticale = self.verticale_id

        def matches_verticale(q):
            if not q.verticale_id:
                return True
            if not verticale:
                return False
            return q.verticale_id.id in (verticale.id, verticale.parent_id.id)

        def first_unanswered(candidates):
            for q in candidates.sorted('sequence'):
                if q.id not in answered_ids and matches_verticale(q):
                    return q
            return Question

        node = after
        while True:
            if node is None:
                pool = Question.search([('parent_id', '=', False)])
                found = first_unanswered(pool)
            else:
                found = first_unanswered(node.child_ids)
                if not found:
                    siblings = node.parent_id.child_ids if node.parent_id else Question.search([('parent_id', '=', False)])
                    found = first_unanswered(siblings)
            if found:
                return found
            if node is None or not node.parent_id:
                return Question
            node = node.parent_id

    def _complete(self):
        """Fine intervista: riversa le risposte con field_key nei campi
        erpv6.production.order gia' esistenti (via crm_lead._start_production,
        stesso ponte usato dal form flat attuale) cosi' Kairos continua a
        funzionare senza modifiche, poi prova a calcolare la matrice
        Kairos se i dati bastano. Nessuno scoring Pareto/Heinrich qui:
        quale metodo si applica a quale domanda dell'intervista leggera non
        e' ancora stato deciso con Denis (discussione 22-23/08/2026),
        implementarlo ora sarebbe inventare una formula non verificata."""
        self.ensure_one()
        self.write({'state': 'completed', 'completed_date': fields.Datetime.now()})

        kwargs = {}
        for answer in self.answer_ids:
            key = answer.question_id.field_key
            if not key:
                continue
            value = answer.option_id.value if answer.option_id else answer.value_text
            if value:
                kwargs[key] = value

        if kwargs and hasattr(self.lead_id, '_start_production'):
            try:
                order = self.lead_id.sudo()._start_production(**kwargs)
            except Exception:
                _logger.exception("Sessione intervista #%s: _start_production fallita.", self.id)
                order = False
            if order:
                try:
                    matrix = order._compute_kairos_matrix()
                    if matrix:
                        self.kairos_matrix_id = matrix.id
                except Exception:
                    _logger.exception("Sessione intervista #%s: calcolo Kairos fallito.", self.id)

        self.message_post(body="Intervista completata (%d risposte)." % len(self.answer_ids))

    def get_next_question_payload(self):
        """Rappresentazione JSON-pronta della domanda corrente, per il
        frontend: testo, tipo risposta, opzioni, messaggio KB contestuale
        se presente, e always_altro sempre vero salvo il caso esplicito.
        Ritorna False se la sessione e' completata."""
        self.ensure_one()
        q = self.current_question_id
        if not q:
            return False
        return {
            'session_id': self.id,
            'question_id': q.id,
            'question_text': q.question_text,
            'answer_type': q.answer_type,
            'options': [{'id': o.id, 'value': o.value} for o in q.option_ids],
            'always_show_altro': q.always_show_altro,
            'contextual_message': q.get_contextual_message() or None,
        }


class Erpv6InterviewAnswer(models.Model):
    """Risposta singola. Volutamente NON eredita erpv6.core.tracked (niente
    mail.thread per record): una sessione puo' avere decine di risposte,
    dare a ciascuna un proprio chatter sarebbe rumore, non tracciabilita' -
    create_date/create_uid nativi di Odoo bastano a livello di singola
    risposta, la tracciabilita' di sostanza (stato, completamento, esito)
    vive sulla sessione.

    is_altro=True e' il segnale del motore vocabolario ("il lead ha scritto
    qualcosa che non conosciamo"): vedi _notify_altro_candidate e
    erpv6.vocabulary.entry, spec chiusa con Denis il 23/08/2026."""
    _name = 'erpv6.interview.answer'
    _description = 'Intervista - Risposta'

    session_id = fields.Many2one('erpv6.interview.session', required=True, ondelete='cascade')
    question_id = fields.Many2one('erpv6.interview.question', required=True, ondelete='restrict')
    option_id = fields.Many2one('erpv6.interview.question.option', ondelete='set null')
    value_text = fields.Char(string='Risposta (testo libero)')
    is_altro = fields.Boolean(string='Da campo "altro"', default=False, index=True)
    vocabulary_entry_id = fields.Many2one('erpv6.vocabulary.entry', string='Termine vocabolario',
                                           ondelete='set null', copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        answers = super().create(vals_list)
        for answer in answers.filtered('is_altro'):
            try:
                self._notify_altro_candidate(answer)
            except Exception:
                _logger.exception("Notifica candidato vocabolario fallita per risposta #%s.", answer.id)
        return answers

    def _notify_altro_candidate(self, answer):
        """Per definizione, quando questo hook scatta e' la prima occorrenza
        di un termine non documentato (nessuna promozione automatica
        possibile, confermato con Denis il 23/08/2026) - al massimo un
        candidato per revisione umana, mai una scrittura diretta a
        erpv6.vertical.catalog. Trova/crea la erpv6.vocabulary.entry
        condivisa per il termine, collega questa risposta, e se l'entry e'
        nuova tenta il deep source e notifica Sabrina UNA volta sola (vedi
        erpv6.vocabulary.entry._process_new_entry)."""
        term = (answer.value_text or '').strip().lower()
        if not term:
            return
        Entry = self.env['erpv6.vocabulary.entry'].sudo()
        entry = Entry.search([('term', '=', term)], limit=1)
        is_new = not entry
        if not entry:
            entry = Entry.create({'term': term})
        answer.vocabulary_entry_id = entry.id
        if is_new:
            entry._process_new_entry(answer)


class Erpv6VocabularyEntry(models.Model):
    """Biblioteca condivisa dei termini scritti nel campo libero "altro"
    dell'intervista, non legata a un lead specifico (piu' lead possono
    scrivere lo stesso termine, es. "elicicoltura"). Nasce sempre da una
    risposta reale, mai inventata. La promozione a riga vera in
    erpv6.vertical.catalog (promoted_verticale_id) e' SEMPRE un click umano
    con scelta esplicita del padre (parent_id) - mai dedotta in automatico,
    anche quando il deep source suggerisce un settore plausibile."""
    _name = 'erpv6.vocabulary.entry'
    _description = 'Intervista - Termine vocabolario candidato'
    _inherit = ['erpv6.core.tracked']

    term = fields.Char(string='Termine', required=True, index=True)
    answer_ids = fields.One2many('erpv6.interview.answer', 'vocabulary_entry_id', string='Risposte collegate')
    state = fields.Selection([
        ('new', 'Nuovo'),
        ('deep_source_in_corso', 'Deep source in corso'),
        ('deep_source_fallito', 'Deep source fallito'),
        ('in_revisione', 'In revisione'),
        ('promosso', 'Promosso'),
        ('scartato', 'Scartato'),
    ], default='new', required=True, tracking=True)
    deep_source_text = fields.Text(string='Testo deep source')
    deep_source_url = fields.Char(string='URL deep source')
    deep_source_fetched_at = fields.Datetime(string='Deep source recuperato il')
    promoted_verticale_id = fields.Many2one('erpv6.vertical.catalog', string='Promosso a prodotto/variante',
                                             copy=False,
                                             help="Valorizzato SOLO alla conferma umana, con padre scelto a mano.")
    notified_at = fields.Datetime(string='Notificato il', copy=False,
                                   help="Valorizzato la prima volta che Sabrina notifica questo termine - "
                                        "evita ri-notifiche per occorrenze successive dello stesso termine.")

    _sql_constraints = [
        ('term_unique', 'unique(term)', 'Questo termine e\' gia\' in biblioteca vocabolario.'),
    ]

    def _process_new_entry(self, answer):
        """Chiamato UNA volta sola, quando l'entry viene creata: prova il
        deep source (mai bloccante - un fallimento non deve impedire la
        notifica) poi notifica sempre Sabrina, una volta sola per termine
        (vedi notified_at)."""
        self.ensure_one()
        try:
            self._run_deep_source()
        except Exception:
            _logger.exception("Deep source fallito per il termine vocabolario '%s' (entry #%s).",
                               self.term, self.id)
            self.state = 'deep_source_fallito'
        self._notify_sabrina(answer)

    def _run_deep_source(self):
        """Chiama direttamente lo scraper generico (erpv6.deep.source.engine
        ._call_scraper_service), SENZA passare da erpv6.deep.source.config
        (richiede kb_category_id obbligatorio, che qui non ha senso - scelta
        confermata con Denis il 23/08/2026). URL costruito da un parametro
        dato (non hardcoded), placeholder di primo passo: da rivedere in una
        sessione dedicata (Denis ha citato ISMEA/Confagricoltura come fonti
        alternative da valutare, non implementate ora)."""
        self.ensure_one()
        self.state = 'deep_source_in_corso'
        template = self.env['ir.config_parameter'].sudo().get_param(
            'erpv6_production.vocabulary_deep_source_url_template',
            default='https://it.wikipedia.org/wiki/{term}',
        )
        url = template.format(term=self.term)
        engine = self.env['erpv6.deep.source.engine']
        html = engine._call_scraper_service(url)
        self.write({
            'state': 'in_revisione',
            'deep_source_text': html,
            'deep_source_url': url,
            'deep_source_fetched_at': fields.Datetime.now(),
        })

    def _notify_sabrina(self, answer):
        """Notifica una tantum (notified_at) - se il termine ricompare da
        un'altra risposta mentre l'entry e' gia' stata notificata, l'answer
        si collega comunque (vedi Erpv6InterviewAnswer._notify_altro_candidate)
        ma non si ri-notifica ne' si ri-tenta il deep source. Nessuna azione
        automatica collegata (action_model/action_method): la promozione
        richiede la scelta umana del padre, non e' un metodo a zero
        argomenti - stesso schema di notify_pending_confirmation gia' usato
        per la scoperta triple KG (kb_extraction_service._raise_triple_discovery_signal),
        ma qui deliberatamente senza action_*."""
        self.ensure_one()
        if self.notified_at:
            return
        sabrina = self.env['erpv6.agent.config'].sudo().search([('code', '=', 'sabrina')], limit=1)
        if not sabrina:
            _logger.warning(
                "Vocabolario intervista: agente Sabrina non trovato (erpv6.agent.config code='sabrina'), "
                "termine '%s' (entry #%s) resta senza notifica.", self.term, self.id)
            return
        facts = [
            _("Termine scritto nel campo libero \"altro\" dell'intervista: \"%s\".") % self.term,
            _("Lead collegato: %s.") % (answer.session_id.lead_id.name or answer.session_id.lead_id.id),
        ]
        if self.state == 'in_revisione':
            facts.append(_("Deep source riuscito: %s") % self.deep_source_url)
        else:
            facts.append(_("Deep source non disponibile (servizio scraper non raggiungibile) - "
                            "nessun testo di supporto, valuta a mano."))
        facts.append(_("Nessuna promozione automatica: per attivarlo in erpv6.vertical.catalog serve "
                        "una scelta umana esplicita del prodotto generico padre."))
        sabrina.notify_pending_confirmation(
            title=_("Nuovo termine dall'intervista: \"%s\"") % self.term,
            facts=facts,
            res_model='erpv6.vocabulary.entry', res_id=self.id,
        )
        self.notified_at = fields.Datetime.now()
