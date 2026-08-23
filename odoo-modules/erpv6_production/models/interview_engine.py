import logging

from odoo import api, fields, models

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
    qualcosa che non conosciamo"): l'hook _notify_altro_candidate e'
    predisposto ma deliberatamente inerte - la logica di cosa succede dopo
    (soglia, chi notifica, cosa diventa il termine) e' in disegno con Denis
    separatamente, vedi conversazione dedicata del 23/08/2026. Non scrivere
    qui logica di promozione a vocabolario finche' quella spec non e'
    chiusa."""
    _name = 'erpv6.interview.answer'
    _description = 'Intervista - Risposta'

    session_id = fields.Many2one('erpv6.interview.session', required=True, ondelete='cascade')
    question_id = fields.Many2one('erpv6.interview.question', required=True, ondelete='restrict')
    option_id = fields.Many2one('erpv6.interview.question.option', ondelete='set null')
    value_text = fields.Char(string='Risposta (testo libero)')
    is_altro = fields.Boolean(string='Da campo "altro"', default=False, index=True)

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
        """STUB predisposto, non ancora attivo: logga soltanto. Per
        definizione, quando questo hook scatta e' la prima occorrenza di un
        termine non documentato (nessuna promozione automatica possibile,
        confermato con Denis il 23/08/2026) - al massimo un candidato per
        revisione umana, mai una scrittura diretta a erpv6.vertical.catalog
        o erpv6.kb.category. Implementare qui quando la spec di design e'
        chiusa (soglia/notifica/instradamento)."""
        _logger.info(
            "Candidato vocabolario (campo 'altro'): sessione #%s, domanda '%s', testo='%s' - "
            "nessuna azione automatica (hook in attesa di spec).",
            answer.session_id.id, answer.question_id.name, answer.value_text,
        )
