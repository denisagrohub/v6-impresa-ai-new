import base64
import json
import logging
import re

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from .kaizen_detected_signal import MANUAL_REPORT_SIGNAL_PREFIX

_logger = logging.getLogger(__name__)

KAIZEN_RULES_CATEGORY_NAME = 'Regole Kaizen'
KAIZEN_RULES_CATEGORY_KB_TYPE = 'metodo_v6'
CHANGELOG_CATEGORY_NAME = 'Changelog Tecnico'
CHANGELOG_CATEGORY_KB_TYPE = 'changelog_tecnico'

# Regole "procedurali" applicate insieme in UNA sola chiamata AI: hanno
# bisogno di ragionamento (motivazione, non un calcolo), ma NON devono mai
# essere saltate -- anche quando non si applicano, la risposta deve dirlo
# esplicitamente (vedi prompt in _apply_procedural_rules). La Regola 4 (dati
# e fatti) e la Regola 11 (scoring) sono gestite a parte: la 4 e' una verifica
# dal vivo sul database, mai un'opinione AI; la 11 rilegge le righe gia'
# scritte per le altre 11 regole, mai il contesto di conversazione.
PROCEDURAL_RULE_NUMBERS = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10]
RULE4_NUMBER = 4
RULE11_NUMBER = 11

# Famiglia di signal_key riconosciuta da QUESTO motore (il sensore "copertura
# grafo" vero e proprio, cron+AI su lista chiusa di modelli, e' ancora da
# costruire -- vedi docs/PLAN_knowledge_graph_phase1.md, "Non ancora
# costruito"). erpv6.kaizen.detected_signal e' un registro CONDIVISO da tutti
# i sensori Kaizen (validation_escalation_stuck, kb_extraction_stuck,
# case_study_stalled, ecc. -- vedi kaizen_detected_signal.py, gia' con
# centinaia di righe storiche non valutate da questo motore): il cron di
# valutazione a 12 regole deve restare scoperto SOLO su questa famiglia,
# mai su tutto il registro, altrimenti (bug reale trovato e corretto il
# 22/08/2026 testando dal vivo) parte una chiamata AI per OGNI segnale
# storico mai collegato a questo motore -- decine/centinaia di chiamate
# sprecate, esattamente la Regola 10 (Muda) che questo stesso motore deve
# applicare. Le altre famiglie di segnali restano coperte dai loro
# meccanismi gia' esistenti (backlog Pareto condiviso + agente giornaliero),
# non da questo motore.
RULE4_LIVE_CHECK_HANDLER_NAMES = {
    'kg_coverage_missing_kaizen_button': '_rule4_check_missing_kaizen_button',
    'kg_coverage_typst_template_unmapped': '_rule4_check_typst_template_coverage',
}

# Dal 22/08/2026, la "famiglia" coperta da questo motore (cron + notifiche)
# non e' piu' solo le due chiavi esatte sopra: include anche QUALUNQUE
# segnale con signal_key che inizia per MANUAL_REPORT_SIGNAL_PREFIX (una
# chiave per segnalazione manuale, es. 'manual_report_2', non un insieme
# chiuso come le due chiavi kg_coverage_* -- vedi
# kaizen_manual_report.py._create_detected_signal). Il dispatch della
# Regola 4 (_apply_rule4) e il filtro del cron (_cron_evaluate_kaizen_rules)
# controllano ENTRAMBI i criteri, mai uno dei due da solo, altrimenti le
# segnalazioni manuali entrerebbero nel registro ma non verrebbero mai
# valutate (o verrebbero valutate senza passare da _belongs_to_rule_engine_family
# per la prima notifica "l'ho visto").

# Il report .md di ogni valutazione NON viene piu' scritto su disco locale
# del container (era /var/lib/odoo/kaizen_signals -- un volume Docker
# nominato, quindi sopravviveva a restart/recreate, ma restava comunque un
# path non tracciato da nessun record Odoo, irraggiungibile per chiunque non
# avesse accesso shell al container: bug reale segnalato da Denis il
# 22/08/2026 testando dal vivo i primi due segnali). Il report vive ora come
# documento REALE e tracciato in erpv6.library.document (stesso registro
# "documenti di progetto" gia' usato da erpv6_production/erpv6_typst per
# tutto cio' che va archiviato con provenienza -- vedi register_document() in
# erpv6_library/models/library_document.py), agganciato al lead fisso
# "Amministrazione KB" (erpv6_production.crm_lead_kb_admin, stesso lead gia'
# riusato da kaizen_agent.py per l'analoga esigenza "cosa e' interno, non di
# un cliente"). La voce erpv6.kb changelog_tecnico che questo motore crea
# punta a quel documento via source_document_id (campo gia' esistente su
# erpv6.kb, erpv6_agent/models/kb_knowledge.py) -- quindi il percorso di
# navigazione reale e' sempre segnale -> fix_kb_id -> voce KB ->
# source_document_id -> documento libreria -> contenuto, mai un path di
# filesystem che si perde se il container viene ricreato.

# Stesso elenco di kaizen_agent.py (duplicato deliberatamente, stesso
# principio gia' seguito altrove in questo modulo per costanti che vivono in
# un altro file -- es. VALIDATION_MAX_AI_FAILURE_RETRIES in
# kaizen_detected_signal.py): se cambia la', va aggiornato anche qui a mano.
_EXISTING_TOOLS_TEXT = (
    "- erpv6.kaizen.manual_report: segnalazione manuale gia' esistente (titolo, descrizione, "
    "gravita', record collegato via res_model/res_id). NON proporre un nuovo modello ticket.\n"
    "- erpv6.heinrich.indicator.log_signal(res_model, res_id, severity, description): metodo "
    "gia' esistente per registrare un segnale (near_miss/lieve/grave) su un record.\n"
    "- erpv6.pareto.analysis.log_item(res_model, res_id, name, frequenza, impatto): metodo "
    "gia' esistente per aggiungere/aggiornare un elemento di backlog.\n"
    "- erpv6.kairos.matrix: matrice Impatto x Prontezza gia' esistente (matrix_type='tecnico' per "
    "casi tecnici come questo).\n"
    "- erpv6.kaizen.detected_signal: registro dedup dei segnali, gia' popolato dal cron di "
    "rilevamento.\n"
    "- Pattern generico res_model/res_id (Char+Integer): usato da TUTTI i motori sopra per "
    "agganciarsi a qualsiasi record esistente, mai un nuovo campo di collegamento dedicato."
)


class Erpv6KaizenDetectedSignalRuleEngine(models.Model):
    """Estende il registro segnali con il motore di applicazione sistematica
    delle 12 Regole Kaizen -- disegno completo in
    docs/KAIZEN_rule_application_worked_example.md e
    docs/PLAN_knowledge_graph_phase1.md (sezione "Estensione - Motore Kaizen
    'copertura grafo'"). Principio guida: la "conoscenza" (il testo di
    ciascuna regola) vive nella KB (categoria 'Regole Kaizen', voci #298-309,
    stessa fonte gia' usata da kaizen_agent.py), il "motore" qui applica
    quelle regole a un segnale reale scrivendo ogni risposta in
    erpv6.kaizen.rule.answer -- MAI ragionando a memoria di conversazione
    (vedi docstring di quel modello per il caso reale che l'ha reso
    necessario)."""
    _inherit = 'erpv6.kaizen.detected_signal'

    rule_answer_ids = fields.One2many(
        'erpv6.kaizen.rule.answer', 'signal_id', string='Risposte alle 12 Regole')
    rules_evaluated_at = fields.Datetime(
        string='Regole Kaizen Valutate Il', readonly=True, copy=False,
        help="Vuoto = non ancora valutato dal cron _cron_evaluate_kaizen_rules. Una volta "
             "valorizzato, il cron non rivaluta piu' automaticamente questo segnale (Regola 10, "
             "evitare lo spreco di richiamare l'AI su qualcosa gia' fatto) -- una rivalutazione va "
             "richiesta esplicitamente con evaluate_12_rules(force=True).")
    fix_kb_id = fields.Many2one(
        'erpv6.kb', string='Voce Changelog (Fix)', readonly=True, copy=False)
    fix_document_id = fields.Many2one(
        'erpv6.library.document', string='Report .md (Documento Libreria)', readonly=True, copy=False,
        help="Documento tracciato in erpv6.library.document con il report completo delle 12 Regole "
             "(sostituisce il vecchio path locale nel container -- vedi commento sopra REPORTS_DIR "
             "rimosso). Stesso documento referenziato da fix_kb_id.source_document_id.")

    @api.model_create_multi
    def create(self, vals_list):
        """Prima notifica di Denis (richiesta esplicita, punto 2): appena un
        segnale della famiglia coperta da questo motore viene registrato --
        sensore automatico O segnalazione manuale, entrambi passano da qui
        dato che kaizen_manual_report.py crea lo stesso identico modello --
        Kaizen scrive subito "l'ho visto", PRIMA che le 12 Regole vengano
        applicate (cron_kaizen_evaluate_rules gira una volta al giorno: senza
        questa notifica immediata, Denis lo scoprirebbe solo il giorno dopo).
        Un errore nella notifica non deve mai impedire la creazione del
        segnale stesso -- loggato, il segnale resta comunque registrato e
        finira' comunque valutato al prossimo giro del cron."""
        signals = super().create(vals_list)
        for signal in signals:
            if signal._belongs_to_rule_engine_family():
                try:
                    signal._notify_kaizen_signal_seen()
                except Exception:
                    _logger.exception(
                        "Notifica 'segnale visto' fallita per il nuovo segnale #%s -- il segnale "
                        "resta comunque registrato e verra' comunque valutato dal cron.", signal.id)
        return signals

    def _belongs_to_rule_engine_family(self):
        """True se questo segnale e' della famiglia che il motore a 12
        Regole copre (vedi commento sopra RULE4_LIVE_CHECK_HANDLER_NAMES) --
        le due chiavi esatte kg_coverage_* OPPURE qualunque chiave con
        prefisso MANUAL_REPORT_SIGNAL_PREFIX. Le altre famiglie storiche
        (validation_escalation_stuck, kb_extraction_stuck, ecc.) restano
        fuori, come gia' deciso per il cron di valutazione."""
        self.ensure_one()
        return bool(
            self.signal_key in RULE4_LIVE_CHECK_HANDLER_NAMES
            or (self.signal_key and self.signal_key.startswith(MANUAL_REPORT_SIGNAL_PREFIX))
        )

    def _resolve_notify_target(self):
        """Record reale su cui Kaizen scrive ENTRAMBE le notifiche di
        questo segnale (vedi requisito esplicito: le due notifiche devono
        stare nello STESSO thread di un caso reale, distinguibili solo per
        contenuto/momento, mai in due thread diversi) -- res_model/res_id
        del segnale stesso quando c'e' un record reale (res_id != 0,
        sempre il caso per le segnalazioni manuali: related_record e'
        obbligatorio), altrimenti il lead fisso 'Amministrazione KB' per i
        segnali aggregati/di classe (stesso fallback gia' usato altrove nel
        progetto per la corrispondenza interna non legata a un cliente).
        Ritorna (None, None) se nemmeno quel lead esiste."""
        self.ensure_one()
        if self.res_id:
            return self.res_model, self.res_id
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        if not kb_admin_lead:
            return None, None
        return 'crm.lead', kb_admin_lead.id

    def _notify_kaizen_signal_seen(self):
        """"Ho visto questo, lo sto guardando" -- breve, linguaggio semplice,
        in prima persona di Kaizen (non piu' via Sabrina: Kaizen ha ora una
        propria voce, vedi partner_id su erpv6.agent.config code='kaizen').
        Quando res_id=0 (segnale aggregato/di classe, es. i due segnali
        kg_coverage_* del worked example) non esiste un record reale su cui
        scrivere nel chatter -- stesso problema gia' risolto altrove nel
        progetto (kaizen_agent.py, _write_document_report) usando il lead
        fisso "Amministrazione KB" come ancora per la corrispondenza interna
        non legata a un cliente specifico. Le segnalazioni manuali non hanno
        mai questo problema (related_record e' un campo obbligatorio su
        erpv6.kaizen.manual_report), ma il codice resta generico per
        qualunque futura fonte di segnali di questa famiglia."""
        self.ensure_one()
        kaizen = self.env['erpv6.agent.config'].search([('code', '=', 'kaizen'), ('active', '=', True)], limit=1)
        if not kaizen:
            _logger.warning(
                "Agente Kaizen non trovato/attivo -- nessuna notifica 'segnale visto' per #%s.", self.id)
            return False
        target_model, target_id = self._resolve_notify_target()
        if not target_model:
            _logger.warning(
                "Segnale #%s aggregato (res_id=0) e lead 'Amministrazione KB' non trovato -- "
                "nessuna notifica 'segnale visto' possibile.", self.id)
            return False
        origin_text = (
            _("una segnalazione manuale") if self.origin == 'segnalazione_manuale'
            else _("il sensore automatico"))
        facts = [
            _("Ho appena registrato un nuovo segnale (chiave '%(key)s'), arrivato da %(origin)s.") % {
                'key': self.signal_key, 'origin': origin_text},
            _("Riguarda %(model)s (record %(id)s).") % {
                'model': self.res_model,
                'id': self.res_id or _("nessuno -- riguarda l'intera classe di record")},
            _("Lo sto guardando: applichero' tutte e 12 le Regole Kaizen e ti scrivo di nuovo "
              "con l'esito."),
        ]
        return kaizen.notify_pending_confirmation(
            title=_("Ho visto un nuovo segnale: %s") % self.signal_key,
            facts=facts,
            res_model=target_model,
            res_id=target_id,
        )

    @api.model
    def _cron_evaluate_kaizen_rules(self):
        """Cron dedicato (data/kaizen_cron.xml): applica le 12 Regole ad ogni
        segnale non ancora valutato DELLA FAMIGLIA coperta da questo motore
        (RULE4_LIVE_CHECK_HANDLER_NAMES + segnali con prefisso
        MANUAL_REPORT_SIGNAL_PREFIX dal 22/08/2026, vedi
        _belongs_to_rule_engine_family) -- MAI a tutto il registro
        condiviso erpv6.kaizen.detected_signal (bug reale trovato e corretto
        il 22/08/2026: senza questo filtro, il cron proverebbe a valutare
        anche le centinaia di segnali storici di altri sensori, con una
        chiamata AI sprecata per ciascuno, violando la Regola 10 che questo
        stesso motore deve applicare). Un solo segnale con un bug nella
        valutazione non deve bloccare gli altri: ogni fallimento viene
        loggato per intero e il segnale resta in coda (rules_evaluated_at
        resta vuoto) per il giro successivo."""
        pending = self.search([
            ('rules_evaluated_at', '=', False),
            '|',
            ('signal_key', 'in', list(RULE4_LIVE_CHECK_HANDLER_NAMES.keys())),
            ('signal_key', 'like', MANUAL_REPORT_SIGNAL_PREFIX + '%'),
        ])
        for signal in pending:
            try:
                signal.evaluate_12_rules()
            except Exception:
                _logger.exception(
                    "Valutazione 12 Regole Kaizen fallita per segnale #%s (%s#%s) -- resta in coda "
                    "per il prossimo giro.", signal.id, signal.res_model, signal.res_id)

    def evaluate_12_rules(self, force=False):
        """Applica le 12 Regole Kaizen a questo segnale, IN ORDINE, scrivendo
        una riga erpv6.kaizen.rule.answer per ciascuna -- poi produce i due
        artefatti (report .md + voce changelog KB), scrive il nodo Fix nel
        grafo Neo4j e notifica Sabrina. force=True cancella le risposte gia'
        scritte e rivaluta da capo (mai un'aggiunta parziale/mista tra un
        giro vecchio e uno nuovo)."""
        self.ensure_one()
        if self.rules_evaluated_at and not force:
            _logger.info("Segnale #%s gia' valutato il %s, salto (force=False).", self.id, self.rules_evaluated_at)
            return self.rule_answer_ids
        if self.rule_answer_ids:
            self.rule_answer_ids.unlink()

        rule_kbs = self._get_rule_kbs()
        missing = [n for n in range(12) if n not in rule_kbs]
        if missing:
            raise UserError(_(
                "Voci KB mancanti nella categoria '%(cat)s' per le regole %(missing)s -- impossibile "
                "valutare senza inventare il testo di quelle regole."
            ) % {'cat': KAIZEN_RULES_CATEGORY_NAME, 'missing': missing})

        # Regola 4 PRIMA di tutte le altre (procedura del worked example: le
        # regole successive devono poter leggere fatti gia' riverificati dal
        # vivo, mai un numero riusato da un turno precedente).
        rule4_result = self._apply_rule4()
        self._write_rule_answer(RULE4_NUMBER, rule_kbs[RULE4_NUMBER].name, rule4_result)

        # Regole procedurali 0,1,2,3,5,6,7,8,9,10 -- IN ORDINE, mai saltate.
        procedural_answers = self._apply_procedural_rules(rule_kbs, rule4_result)
        for rule_number in PROCEDURAL_RULE_NUMBERS:
            self._write_rule_answer(rule_number, rule_kbs[rule_number].name, procedural_answers[rule_number])

        # Regola 11 PER ULTIMA: rilegge le righe gia' scritte sopra (query
        # reale sulla tabella, mai il contesto di conversazione).
        rule11_result = self._apply_rule11(rule_kbs)
        self._write_rule_answer(RULE11_NUMBER, rule_kbs[RULE11_NUMBER].name, rule11_result)

        self.rules_evaluated_at = fields.Datetime.now()

        document = self._write_document_report()
        kb_entry = self._write_changelog_kb(document)
        neo4j_result = self._write_neo4j_fix(kb_entry)
        self._notify_kaizen_evaluation_complete(kb_entry, neo4j_result)
        self._create_structured_communication(kb_entry)

        return self.rule_answer_ids

    # ------------------------------------------------------------------
    # Regole KB (conoscenza) -- lette, mai duplicate a mano nel codice
    # ------------------------------------------------------------------

    def _get_rule_kbs(self):
        """Le 12 voci KB #298-309 (categoria 'Regole Kaizen'), indicizzate
        per numero regola (estratto dal prefisso del nome, es. '4. Basarsi
        su dati...' -> 4). get_or_create sulla categoria (stesso idioma gia'
        usato ovunque nel progetto): se la categoria non esiste ancora non
        la sto inventando, la sto solo trovando con la stessa chiave logica
        (name, kb_type) gia' usata da kaizen_agent_config.xml."""
        category = self.env['erpv6.kb.category'].get_or_create(
            KAIZEN_RULES_CATEGORY_NAME, KAIZEN_RULES_CATEGORY_KB_TYPE, is_transversal=True)
        kbs = self.env['erpv6.kb'].search([('category_id', '=', category.id), ('is_active', '=', True)])
        by_number = {}
        for kb in kbs:
            m = re.match(r'^(\d+)\.', kb.name or '')
            if m:
                by_number[int(m.group(1))] = kb
        return by_number

    def _write_rule_answer(self, rule_number, rule_name, result):
        self.ensure_one()
        self.env['erpv6.kaizen.rule.answer'].create({
            'signal_id': self.id,
            'rule_number': rule_number,
            'rule_name': rule_name,
            'answer_text': result['answer_text'],
            'supporting_data': result.get('supporting_data') or {},
            'verified_live': result.get('verified_live', False),
        })

    # ------------------------------------------------------------------
    # Regola 4 -- dati e fatti, riverifica dal vivo (mai un'opinione AI)
    # ------------------------------------------------------------------

    def _apply_rule4(self):
        """Dispatch per signal_key: ogni tipo di segnale reale ha una propria
        verifica dal vivo specifica (i fatti da riverificare sono diversi per
        ciascun tipo). Un signal_key senza handler dedicato NON viene
        inventato: la risposta dichiara esplicitamente il dato come non
        verificabile (flagged_missing_data), mai stimato."""
        self.ensure_one()
        handler_name = RULE4_LIVE_CHECK_HANDLER_NAMES.get(self.signal_key)
        if not handler_name and self.signal_key and self.signal_key.startswith(MANUAL_REPORT_SIGNAL_PREFIX):
            handler_name = '_rule4_check_manual_report'
        handler = getattr(self, handler_name) if handler_name else None
        if not handler:
            return {
                'answer_text': _(
                    "Nessuna verifica dal vivo specifica implementata per la chiave segnale '%s'. "
                    "Dato non verificabile automaticamente in questo momento -- dichiarato "
                    "esplicitamente mancante, non stimato (regola anti-allucinazione del progetto)."
                ) % self.signal_key,
                'supporting_data': {'flagged_missing_data': True, 'signal_key': self.signal_key},
                'verified_live': False,
            }
        return handler()

    def _rule4_check_missing_kaizen_button(self):
        """Segnale A: verifica dal vivo se esiste un'azione contestuale
        (binding_model_id) verso erpv6.kaizen.manual_report -- query REALE su
        ir.actions.act_window, non un grep interpretato a memoria."""
        self.ensure_one()
        Action = self.env['ir.actions.act_window'].sudo()
        bound_actions = Action.search([
            ('res_model', '=', 'erpv6.kaizen.manual_report'),
            ('binding_model_id', '!=', False),
        ])
        total_kaizen_actions = Action.search_count([('res_model', 'like', 'erpv6.kaizen%')])
        verified_at = fields.Datetime.now()
        if bound_actions:
            conclusion = _(
                "ATTENZIONE: risultato diverso dalla premessa del segnale -- %d azione/i contestuale/i "
                "trovata/e ORA. Il segnale va rivalutato, non e' piu' confermato allo stato attuale."
            ) % len(bound_actions)
        else:
            conclusion = _("Confermato dal vivo: nessuna azione contestuale (binding_model_id) esiste ancora.")
        return {
            'answer_text': _(
                "Verificato dal vivo ora (%(ts)s) con una query reale su ir.actions.act_window: "
                "%(n)d azioni con binding_model_id puntano a erpv6.kaizen.manual_report, su "
                "%(tot)d azioni totali dei modelli erpv6.kaizen*. %(concl)s"
            ) % {
                'ts': verified_at, 'n': len(bound_actions), 'tot': total_kaizen_actions,
                'concl': conclusion,
            },
            'supporting_data': {
                'query': "ir.actions.act_window[res_model=erpv6.kaizen.manual_report, binding_model_id!=False]",
                'bound_actions_count': len(bound_actions),
                'bound_action_ids': bound_actions.ids,
                'total_kaizen_actions': total_kaizen_actions,
                'verified_at': str(verified_at),
            },
            'verified_live': True,
        }

    def _rule4_check_typst_template_coverage(self):
        """Segnale B: riconta dal vivo i record erpv6.typst.template totali e
        con typst_source vuoto -- stessi numeri (11/7) del worked example, ma
        RIVERIFICATI ora con una query reale, non riusati dal documento
        (errore fatto e corretto proprio su questo caso nel worked example:
        vedi docs/KAIZEN_rule_application_worked_example.md, Regola 4)."""
        self.ensure_one()
        Template = self.env['erpv6.typst.template'].sudo()
        total = Template.search_count([])
        empty = Template.search_count([('typst_source', 'in', [False, ''])])
        verified_at = fields.Datetime.now()
        return {
            'answer_text': _(
                "Verificato dal vivo ora (%(ts)s) con una query reale su erpv6.typst.template: "
                "%(total)d record totali, %(empty)d con typst_source vuoto/nullo. Il vocabolario del "
                "Knowledge Graph (docs/PLAN_knowledge_graph_phase1.md) non rappresenta ancora questo "
                "modello -- e' esattamente questo segnale a colmare quel buco (vedi Fix scritto a "
                "fine valutazione)."
            ) % {'ts': verified_at, 'total': total, 'empty': empty},
            'supporting_data': {
                'query': "erpv6.typst.template.search_count(...)",
                'total_records': total,
                'empty_typst_source_records': empty,
                'verified_at': str(verified_at),
            },
            'verified_live': True,
        }

    def _rule4_check_manual_report(self):
        """Regola 4 per un segnale nato da una segnalazione manuale
        (signal_key con prefisso MANUAL_REPORT_SIGNAL_PREFIX). Qui non c'e'
        un conteggio da ricalcolare come per le due chiavi kg_coverage_*:
        il "dato" e' gia' un fatto (quello che l'umano ha scritto), non
        un'opinione -- la verifica dal vivo consiste nel riconfermare ORA
        che la segnalazione originale e il suo record collegato esistano
        ancora, e nel riportare il testo ESATTO scritto dall'umano (mai
        riassunto o reinterpretato dall'AI in questo punto: la sintesi
        arriva dopo, nelle regole procedurali, ma sempre a partire da questi
        fatti grezzi)."""
        self.ensure_one()
        verified_at = fields.Datetime.now()
        report = self.manual_report_id
        if not report or not report.exists():
            return {
                'answer_text': _(
                    "Segnale marcato come segnalazione manuale ma la segnalazione di origine non e' "
                    "(piu') raggiungibile -- dato non verificabile ora, dichiarato esplicitamente "
                    "mancante, non inventato."
                ),
                'supporting_data': {'flagged_missing_data': True, 'signal_key': self.signal_key},
                'verified_live': False,
            }
        related = report.related_record
        related_exists = bool(related and related.exists())
        return {
            'answer_text': _(
                "Verificato dal vivo ora (%(ts)s): la segnalazione manuale #%(rid)s (di %(reporter)s) "
                "esiste ancora nel database, gravita' dichiarata '%(sev)s'. Titolo: \"%(title)s\". "
                "Descrizione originale scritta dall'umano, riportata testualmente (non riassunta): "
                "\"%(desc)s\". Il record collegato %(model)s#%(id)s %(exists)s."
            ) % {
                'ts': verified_at, 'rid': report.id, 'reporter': report.reporter_id.name or '?',
                'sev': report.severity, 'title': report.name, 'desc': report.description,
                'model': self.res_model, 'id': self.res_id,
                'exists': _("esiste ancora ora") if related_exists else _("NON esiste piu' -- da verificare"),
            },
            'supporting_data': {
                'query': "erpv6.kaizen.manual_report.browse(%d).related_record.exists()" % report.id,
                'manual_report_id': report.id,
                'severity_declared': report.severity,
                'reporter': report.reporter_id.name,
                'related_record_exists_now': related_exists,
                'verified_at': str(verified_at),
            },
            'verified_live': True,
        }

    # ------------------------------------------------------------------
    # Regole procedurali (0,1,2,3,5,6,7,8,9,10) -- una chiamata AI, mai
    # saltate, sempre grounded sui fatti della Regola 4.
    # ------------------------------------------------------------------

    def _compose_signal_context(self, rule4_result):
        self.ensure_one()
        return _(
            "SEGNALE: chiave='%(key)s', modello collegato='%(model)s', id_record=%(id)s "
            "(0 = aggregato/l'intera classe di record, non un singolo record), rilevato_il=%(det)s.\n\n"
            "FATTI VERIFICATI DAL VIVO ORA (Regola 4 -- NON riusare numeri di un turno precedente, "
            "basati SOLO su questi):\n%(facts)s"
        ) % {
            'key': self.signal_key, 'model': self.res_model, 'id': self.res_id,
            'det': self.detected_at, 'facts': rule4_result['answer_text'],
        }

    def _apply_procedural_rules(self, rule_kbs, rule4_result):
        self.ensure_one()
        rules_text = "\n\n".join(
            "### Regola %d: %s\n%s" % (n, rule_kbs[n].name, rule_kbs[n].content)
            for n in PROCEDURAL_RULE_NUMBERS
        )
        system_prompt = (
            "Sei il motore di applicazione delle Regole Kaizen del sistema erpv6. Applica CIASCUNA "
            "delle regole sotto al segnale reale descritto, IN ORDINE. Ogni regola va risposta "
            "esplicitamente, anche quando non si applica al caso: in quel caso rispondi comunque con "
            "\"applicable\": false e spiega il motivo nel testo -- MAI saltare una regola, mai "
            "lasciarla vuota. Basati SOLO sui fatti forniti nel contesto sotto (gia' riverificati dal "
            "vivo dalla Regola 4) -- non inventare numeri, nomi di file o dettagli non presenti. "
            "Scrivi in italiano, linguaggio semplice e concreto. Rispondi SOLO con un oggetto JSON "
            "valido, senza markdown code fence, senza altro testo, con esattamente una chiave per "
            "ciascun numero di regola sotto forma di stringa: "
            '{"0": {"answer_text": "...", "applicable": true}, "1": {"answer_text": "...", '
            '"applicable": true}, ...}\n\n'
            "STRUMENTI GIA' ESISTENTI IN erpv6_kaizen (Regole 2/8/9 -- se la soluzione esiste gia', "
            "la risposta deve dire di riusarla, MAI proporre di duplicarla):\n%(tools)s\n\n"
            "REGOLE DA APPLICARE:\n%(rules)s"
        ) % {'tools': _EXISTING_TOOLS_TEXT, 'rules': rules_text}
        user_content = self._compose_signal_context(rule4_result)

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='kaizen_agent_propose',
            payload={
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content},
                ],
            },
            context={'source': 'erpv6_kaizen:evaluate_12_rules:procedural', 'signal_id': self.id},
        )
        answers = {}
        if not result.get('success'):
            _logger.warning(
                "Regole procedurali Kaizen: chiamata AI fallita per segnale #%s: %s",
                self.id, result.get('error'))
            for n in PROCEDURAL_RULE_NUMBERS:
                answers[n] = {
                    'answer_text': _(
                        "Chiamata AI fallita (%s): risposta non disponibile in questo giro, richiede "
                        "revisione manuale -- non inventata."
                    ) % result.get('error'),
                    'supporting_data': {'ai_call_failed': True, 'error': result.get('error')},
                    'verified_live': False,
                }
            return answers
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning(
                "Regole procedurali Kaizen: risposta AI in formato inatteso per segnale #%s: %s",
                self.id, e)
            for n in PROCEDURAL_RULE_NUMBERS:
                answers[n] = {
                    'answer_text': _(
                        "Risposta AI in formato inatteso (%s): non utilizzabile in questo giro, non "
                        "inventata."
                    ) % e,
                    'supporting_data': {'ai_parse_failed': True},
                    'verified_live': False,
                }
            return answers
        for n in PROCEDURAL_RULE_NUMBERS:
            entry = parsed.get(str(n))
            if not entry or not entry.get('answer_text'):
                answers[n] = {
                    'answer_text': _(
                        "La risposta AI non includeva questa regola -- dichiarato mancante, non "
                        "inventato qui."
                    ),
                    'supporting_data': {'missing_from_ai_response': True},
                    'verified_live': False,
                }
            else:
                answers[n] = {
                    'answer_text': entry['answer_text'],
                    'supporting_data': {
                        'applicable': entry.get('applicable', True),
                        'provider_used': result.get('provider_used'),
                    },
                    'verified_live': False,
                }
        return answers

    # ------------------------------------------------------------------
    # Regola 11 -- rubrica di scoring, PER ULTIMA, rilegge le righe scritte
    # ------------------------------------------------------------------

    def _apply_rule11(self, rule_kbs):
        self.ensure_one()
        previous = self.env['erpv6.kaizen.rule.answer'].search([
            ('signal_id', '=', self.id), ('rule_number', 'in', list(range(11))),
        ], order='rule_number')
        if len(previous) < 11:
            return {
                'answer_text': _(
                    "Impossibile applicare la Regola 11: solo %d/11 regole precedenti risultano "
                    "scritte in tabella -- rilettura obbligatoria fallita, scoring NON eseguito (mai "
                    "a memoria di conversazione)."
                ) % len(previous),
                'supporting_data': {'flagged_missing_data': True, 'previous_rules_found': len(previous)},
                'verified_live': False,
            }
        previous_text = "\n\n".join(
            "Regola %d (%s): %s" % (a.rule_number, a.rule_name, a.answer_text) for a in previous)

        # Indicatore 5 di Kairos: query REALE sul grafo (primo caso d'uso del
        # motore di interrogazione condiviso), mai stimata dall'AI.
        neo4j_error = None
        fix_count = None
        try:
            fix_count = self.env['erpv6.kaizen.neo4j.client'].count_fixes_touching_model(self.res_model)
            indicatore_5 = 3 if fix_count >= 1 else 1
        except Exception as e:
            _logger.warning(
                "Regola 11: query Neo4j per l'Indicatore 5 fallita per segnale #%s: %s", self.id, e)
            neo4j_error = str(e)
            # Fallback prudente: MAI 3 (mai assumere "esperienza pregressa" senza una prova reale
            # quando la query fallisce) -- 1 e' il valore che corrisponde a "prima volta in
            # assoluto", coerente con l'assenza di dati verificabili in questo momento.
            indicatore_5 = 1

        system_prompt = (
            "Sei il motore di scoring Kaizen del sistema erpv6. Assegna i punteggi Pareto/Kairos/"
            "Heinrich per il segnale sotto SOLO seguendo questa rubrica (criteri osservabili, mai "
            "impressioni):\n\n%(rubric)s\n\n"
            "L'Indicatore 5 di Kairos (esperienza pregressa) e' GIA' stato determinato con una query "
            "reale sul grafo di conoscenza (%(ind5)d, %(ind5_note)s) -- non richiederlo, non "
            "modificarlo.\n\n"
            "Rispondi SOLO con un oggetto JSON valido, senza markdown code fence, senza altro testo:\n"
            '{"pareto": {"frequenza": 1, "impatto": 1}, '
            '"kairos": {"impatto_score": 1, "indicatore_1": 1, "indicatore_2": 1, "indicatore_3": 1, '
            '"indicatore_4": 1}, '
            '"heinrich": {"severity": "near_miss|lieve|grave"}, '
            '"reasoning": "motivazione breve dei numeri scelti, in italiano"}'
        ) % {
            'rubric': rule_kbs[RULE11_NUMBER].content,
            'ind5': indicatore_5,
            'ind5_note': (
                _("un Fix analogo e' gia' collegato a questo stesso modello nel grafo") if fix_count
                else _("nessun Fix precedente trovato collegato a questo modello nel grafo")
            ) if neo4j_error is None else _("query fallita, valore di fallback prudente usato: %s" % neo4j_error),
        }
        user_content = _(
            "SEGNALE: chiave='%(key)s', modello='%(model)s', id=%(id)s.\n\n"
            "RISPOSTE GIA' SCRITTE PER LE REGOLE 0-10 (rilette ora dalla tabella, non a memoria):\n"
            "%(previous)s"
        ) % {'key': self.signal_key, 'model': self.res_model, 'id': self.res_id, 'previous': previous_text}

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='kaizen_agent_propose',
            payload={
                'temperature': 0.1,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content},
                ],
            },
            context={'source': 'erpv6_kaizen:evaluate_12_rules:rule11', 'signal_id': self.id},
        )
        if not result.get('success'):
            return {
                'answer_text': _(
                    "Chiamata AI per lo scoring (Regola 11) fallita: %s. Nessun punteggio Pareto/"
                    "Kairos/Heinrich scritto in questo giro -- non inventato."
                ) % result.get('error'),
                'supporting_data': {'ai_call_failed': True, 'error': result.get('error'),
                                     'indicatore_5': indicatore_5, 'neo4j_error': neo4j_error},
                'verified_live': neo4j_error is None,
            }
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
            pareto = parsed['pareto']
            kairos = parsed['kairos']
            heinrich_severity = parsed['heinrich']['severity']
            reasoning = parsed.get('reasoning', '')
            if heinrich_severity not in ('near_miss', 'lieve', 'grave'):
                raise ValueError("severity fuori vocabolario: %r" % heinrich_severity)
        except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as e:
            return {
                'answer_text': _(
                    "Risposta AI per lo scoring (Regola 11) in formato inatteso: %s. Nessun punteggio "
                    "scritto -- non inventato."
                ) % e,
                'supporting_data': {'ai_parse_failed': True, 'indicatore_5': indicatore_5,
                                     'neo4j_error': neo4j_error},
                'verified_live': neo4j_error is None,
            }

        short_name = _("Kaizen: %s (%s)") % (self.signal_key, self.res_model)
        pareto_analysis = self.env['erpv6.pareto.analysis'].log_item(
            self.res_model, self.res_id, name=short_name,
            frequenza=pareto['frequenza'], impatto=pareto['impatto'])
        kairos_matrix = self.env['erpv6.kairos.matrix'].create({
            'res_model': self.res_model,
            'res_id': self.res_id,
            'matrix_type': 'tecnico',
            'impatto_score': kairos['impatto_score'],
            'indicatore_1': kairos['indicatore_1'],
            'indicatore_2': kairos['indicatore_2'],
            'indicatore_3': kairos['indicatore_3'],
            'indicatore_4': kairos['indicatore_4'],
            'indicatore_5': indicatore_5,
            'notes': reasoning,
        })
        heinrich_indicator = self.env['erpv6.heinrich.indicator'].log_signal(
            self.res_model, self.res_id, heinrich_severity,
            description=_("[Kaizen 12 Regole, segnale #%s] %s") % (self.id, reasoning))
        pareto_item = pareto_analysis.item_ids.filtered(lambda i: i.name == short_name)[:1]

        answer_text = _(
            "Pareto: frequenza=%(freq)d, impatto=%(imp)d, punteggio=%(score)d%(prio)s. "
            "Kairos Tecnico: impatto_score=%(kimp)d, indicatori=[%(i1)d,%(i2)d,%(i3)d,%(i4)d,%(i5)d "
            "(Indicatore 5 = query reale sul grafo, %(i5note)s)], prontezza_totale=%(pront)d "
            "(%(pront_level)s), quadrante=%(quad)s. Heinrich: %(sev)s. Motivazione: %(reason)s"
        ) % {
            'freq': pareto['frequenza'], 'imp': pareto['impatto'],
            'score': pareto_item.punteggio if pareto_item else pareto['frequenza'] * pareto['impatto'],
            'prio': _(" (PRIORITARIO nel backlog)") if pareto_item and pareto_item.is_priority else "",
            'kimp': kairos['impatto_score'],
            'i1': kairos['indicatore_1'], 'i2': kairos['indicatore_2'], 'i3': kairos['indicatore_3'],
            'i4': kairos['indicatore_4'], 'i5': indicatore_5,
            'i5note': (_("nessun Fix precedente su questo modello") if not fix_count
                       else _("%d Fix precedente/i gia' collegato/i a questo modello") % fix_count)
                      if neo4j_error is None else _("query Neo4j fallita: %s") % neo4j_error,
            'pront': kairos_matrix.prontezza_totale, 'pront_level': kairos_matrix.prontezza_level,
            'quad': kairos_matrix.quadrante,
            'sev': heinrich_severity, 'reason': reasoning,
        }
        return {
            'answer_text': answer_text,
            'supporting_data': {
                'pareto': pareto, 'kairos': dict(kairos, indicatore_5=indicatore_5),
                'heinrich_severity': heinrich_severity,
                'pareto_analysis_id': pareto_analysis.id, 'kairos_matrix_id': kairos_matrix.id,
                'heinrich_indicator_id': heinrich_indicator.id,
                'indicatore_5_source': 'neo4j_query', 'fix_count_same_model': fix_count,
                'neo4j_error': neo4j_error,
            },
            'verified_live': True,
        }

    # ------------------------------------------------------------------
    # Artefatti finali: report .md, voce changelog KB, nodo Fix, Sabrina
    # ------------------------------------------------------------------

    def _build_md_report_content(self):
        """Costruisce il testo del report .md (invariato rispetto alla
        versione precedente) -- separato dalla scrittura vera e propria cosi'
        da poterlo passare come file_data a register_document() invece che a
        Path.write_text()."""
        self.ensure_one()
        lines = [
            "# Kaizen — valutazione delle 12 Regole, segnale #%d" % self.id,
            "",
            "Generato automaticamente il %s, stesso metodo di "
            "docs/KAIZEN_rule_application_worked_example.md (ogni risposta scritta e riletta da "
            "erpv6.kaizen.rule.answer, mai a memoria di conversazione)." % fields.Datetime.now(),
            "",
            "**Segnale**: chiave `%s`, record `%s#%s`, rilevato il %s." % (
                self.signal_key, self.res_model, self.res_id, self.detected_at),
            "",
        ]
        for answer in self.rule_answer_ids.sorted(lambda a: a.rule_number):
            lines.append("## Regola %d — %s" % (answer.rule_number, answer.rule_name or ''))
            lines.append("")
            lines.append(answer.answer_text or '')
            if answer.verified_live:
                lines.append("")
                lines.append("_Verificato dal vivo in questo giro._")
            lines.append("")
        return "\n".join(lines)

    def _write_document_report(self):
        """Registra il report .md come documento tracciato in
        erpv6.library.document (mai piu' su un path locale del container --
        vedi commento sopra REPORTS_DIR rimosso). category='other' (Altro):
        nessuna delle categorie esistenti descrive un report tecnico interno
        generato dal sistema di manutenzione (le piu' vicine, 'agent_knowledge'
        e 'kb_source', sono entrambe input DA elaborare per la KB, non un
        output gia' prodotto; questo e' un output, coerente con la regola del
        progetto "typst->library per gli interni" -- non client-facing, quindi
        is_final_client_facing resta False e NON triggera certificazione
        blockchain, riservata ai documenti esterni). project_id = lead fisso
        "Amministrazione KB" (erpv6_production.crm_lead_kb_admin), stesso
        riusato da kaizen_agent.py per la stessa esigenza -- MAI un nuovo lead."""
        self.ensure_one()
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        if not kb_admin_lead:
            raise UserError(_(
                "Lead 'Amministrazione KB' (erpv6_production.crm_lead_kb_admin) non trovato -- "
                "impossibile registrare il report come documento tracciato senza inventare un "
                "progetto. Verificare che erpv6_production sia installato/aggiornato."
            ))
        content = self._build_md_report_content()
        date_str = fields.Date.context_today(self).isoformat()
        filename = "%s_signal_%d.md" % (date_str, self.id)
        document = self.env['erpv6.library.document'].register_document(
            project_id=kb_admin_lead.id,
            name=_("Kaizen — Report 12 Regole — segnale #%s") % self.id,
            category='other',
            origin='generated',
            source_model='erpv6.kaizen.detected_signal',
            source_res_id=self.id,
            file_data=base64.b64encode(content.encode('utf-8')),
            file_name=filename,
        )
        self.fix_document_id = document.id
        return document

    def _write_changelog_kb(self, document):
        self.ensure_one()
        category = self.env['erpv6.kb.category'].get_or_create(
            CHANGELOG_CATEGORY_NAME, CHANGELOG_CATEGORY_KB_TYPE, is_transversal=True)
        rule11 = self.rule_answer_ids.filtered(lambda a: a.rule_number == RULE11_NUMBER)
        summary = rule11.answer_text if rule11 else _("(Regola 11 non disponibile in questo giro)")
        content = (
            "**Kaizen — valutazione delle 12 Regole applicata al segnale `%(key)s` su "
            "`%(model)s#%(id)s`**\n\n%(summary)s\n\nReport completo: documento libreria "
            "erpv6.library.document #%(doc_id)s (`%(doc_name)s`)."
        ) % {
            'key': self.signal_key, 'model': self.res_model, 'id': self.res_id,
            'summary': summary, 'doc_id': document.id, 'doc_name': document.name,
        }
        kb = self.env['erpv6.kb'].create({
            'name': "Kaizen - 12 Regole applicate - segnale #%d - %s" % (self.id, fields.Datetime.now()),
            'kb_type': CHANGELOG_CATEGORY_KB_TYPE,
            'category_id': category.id,
            'content': content,
            'content_format': 'markdown',
            'access_level': 'admin',
            'is_active': True,
            'source_document_id': document.id,
        })
        self.fix_kb_id = kb.id
        return kb

    def _write_neo4j_fix(self, kb_entry):
        """Nodo Fix (schema 1B, label Kb_Fix) MERGE-ato nel grafo + arco
        TOCCA verso il Code_Modello di questo segnale -- Regola 9
        (standardizzazione) resa persistente e interrogabile, non solo un
        flag di stato nel DB. Un errore qui non deve far fallire l'intera
        valutazione (il segnale resta comunque valutato/tracciato in Odoo):
        loggato e restituito, mai inghiottito in silenzio."""
        self.ensure_one()
        fix_id = "erpv6.kb:%d" % kb_entry.id
        try:
            return self.env['erpv6.kaizen.neo4j.client'].write_fix_node(
                fix_id=fix_id,
                sources=[fix_id],
                descrizione=kb_entry.name,
                data=fields.Date.context_today(self).isoformat(),
                res_model=self.res_model,
            )
        except Exception as e:
            _logger.error("Scrittura nodo Fix in Neo4j fallita per segnale #%s: %s", self.id, e)
            return {'error': str(e), 'fix_id': fix_id}

    def _plain_language_lookup(self, category_xmlid, key):
        """Legge una traduzione tecnico->semplice da una voce KB (name=key,
        content=frase), invece di un dizionario Python -- vedi
        data/kaizen_plain_language_data.xml per il perche' resta una voce
        KB deterministica (mai riformulata dall'AI) e non un'altra
        chiamata AI: stesso principio anti-allucinazione di
        _compose_notice_text, qui applicato al CONTENUTO (il significato di
        un quadrante/una gravita'), non solo al tono. Stringa vuota se la
        categoria/voce non esiste (mai un'eccezione che blocca la
        notifica -- il chiamante gestisce comunque un pezzo mancante con
        `filter(None, ...)`)."""
        category = self.env.ref(category_xmlid, raise_if_not_found=False)
        if not category:
            return ''
        kb = self.env['erpv6.kb'].search(
            [('category_id', '=', category.id), ('name', '=', key), ('is_active', '=', True)], limit=1)
        return kb.content or '' if kb else ''

    def _plain_language_outcome(self, rule11):
        """Traduce l'esito tecnico della Regola 11 (Pareto/Kairos/Heinrich,
        gergo interno del motore) in 2-3 frasi comprensibili senza sapere
        cosa sono Pareto/Kairos/Heinrich -- Denis e' stato esplicito piu'
        volte che le notifiche a lui devono essere in linguaggio semplice,
        mai gergo tecnico. Nota architetturale: la traduzione avviene QUI,
        prima di passare i "facts" a Kaizen (dal 22/08/2026 Kaizen notifica
        in prima persona, non piu' tramite Sabrina -- vedi partner_id su
        erpv6.agent.config code='kaizen'), non contando sul tono
        dell'agente per farlo: i fatti forniti devono gia' essere in
        chiaro, l'agente sceglie solo le parole/il tono, mai il contenuto
        (stesso principio anti-allucinazione gia' documentato in
        _compose_notice_text). Le frasi stesse (corretto il 23/08/2026,
        audit "motore vs conoscenza") vivono in voci KB (vedi
        _plain_language_lookup), non piu' in dizionari Python -- un admin
        le puo' correggere senza promote del modulo, restando comunque
        testo deterministico, mai generato dall'AI in questo punto."""
        if not rule11 or not rule11.supporting_data or rule11.supporting_data.get('flagged_missing_data') \
                or rule11.supporting_data.get('ai_call_failed') or rule11.supporting_data.get('ai_parse_failed'):
            return _("Non sono ancora riuscita a farmi un'idea precisa di quanto sia urgente/grave "
                      "questo segnale in questo giro -- serve una revisione manuale.")
        data = rule11.supporting_data
        pareto = data.get('pareto') or {}
        frequenza_plain = _("capita spesso") if pareto.get('frequenza', 0) >= 4 else (
            _("capita ogni tanto") if pareto.get('frequenza', 0) >= 2 else _("è un caso isolato per ora"))
        # Quadrante letto DAL vero campo compute su erpv6.kairos.matrix
        # (kairos_matrix_id, gia' nel supporting_data -- vedi
        # _evaluate_rule_11), non piu' ricalcolato a mano qui con una
        # seconda copia della stessa logica di
        # erpv6_methodology/models/kairos_matrix.py._compute_quadrante
        # (corretto il 23/08/2026, audit "motore vs conoscenza": due
        # implementazioni della stessa regola potevano divergere).
        kairos_matrix = self.env['erpv6.kairos.matrix'].browse(data.get('kairos_matrix_id'))
        quadrante = kairos_matrix.quadrante if kairos_matrix.exists() else None
        severity = data.get('heinrich_severity')
        return " ".join(filter(None, [
            frequenza_plain.capitalize() + ".",
            self._plain_language_lookup('erpv6_kaizen.kb_category_kaizen_severity_plain', severity) if severity else '',
            self._plain_language_lookup('erpv6_kaizen.kb_category_kaizen_quadrante_plain', quadrante) if quadrante else '',
        ]))

    def _notify_kaizen_evaluation_complete(self, kb_entry, neo4j_result):
        """Seconda notifica di Denis (punto 2, richiesta esplicita): il
        riepilogo delle 12 Regole in linguaggio semplice, a fine
        valutazione -- firmata da Kaizen in prima persona (fino al
        22/08/2026 passava da Sabrina; ora Kaizen ha una propria voce, vedi
        partner_id su erpv6.agent.config code='kaizen'). Nessuna azione
        predefinita agganciata per ora (nessuna esiste ancora per questo
        tipo di evento): resta tracciata come 'in attesa', consapevolezza
        pura finche' non viene agganciata un'azione reale -- ma il thread
        resta comunque un canale di dialogo vero (vedi
        erpv6.agent.confirmation._check_for_confirmation, risposta
        conversazionale a qualunque domanda che non sia la parola chiave)."""
        self.ensure_one()
        kaizen = self.env['erpv6.agent.config'].search([('code', '=', 'kaizen'), ('active', '=', True)], limit=1)
        if not kaizen:
            _logger.warning("Agente Kaizen non trovato/attivo -- nessuna notifica inviata per segnale #%s.", self.id)
            return False
        target_model, target_id = self._resolve_notify_target()
        if not target_model:
            _logger.warning(
                "Segnale #%s aggregato (res_id=0) e lead 'Amministrazione KB' non trovato -- "
                "nessuna notifica di fine valutazione possibile.", self.id)
            return False
        rule11 = self.rule_answer_ids.filtered(lambda a: a.rule_number == RULE11_NUMBER)
        facts = [
            _("Segnale collegato a %(model)s (record %(id)s).") % {
                'model': self.res_model,
                'id': self.res_id or _('nessuno, riguarda l\'intera classe di record')},
            _("Ho applicato tutte e 12 le Regole Kaizen a questo segnale, una per una, e ho scritto "
              "ogni risposta in una tabella cosi' non me le dimentico."),
            self._plain_language_outcome(rule11),
            _("Ho scritto una nota tecnica in Knowledge Base: %s") % kb_entry.name,
        ]
        if neo4j_result and neo4j_result.get('edge_created'):
            facts.append(_("Ho collegato questo aggiornamento al grafo di conoscenza del codice."))
        elif neo4j_result and neo4j_result.get('error'):
            facts.append(_(
                "Non sono riuscita a collegare questo aggiornamento al grafo di conoscenza in questo "
                "momento (%s) -- da verificare.") % neo4j_result['error'])
        elif neo4j_result and not neo4j_result.get('code_model_found'):
            facts.append(_(
                "Non ho trovato il modulo/modello corrispondente gia' nel grafo del codice, quindi "
                "l'ho registrato senza collegarlo -- da verificare."))
        return kaizen.notify_pending_confirmation(
            title=_("Ho valutato un segnale Kaizen: %s") % kb_entry.name,
            facts=facts,
            res_model=target_model,
            res_id=target_id,
        )

    def _create_structured_communication(self, kb_entry):
        """Compito 4/3 (23/08/2026): oltre all'avviso in voce propria sopra
        (linguaggio semplice, per Denis), registra ANCHE la stessa
        valutazione come erpv6.agent.communication -- lo schema standard
        strutturato (chi/quando/azione/problema/valutazione/esito/rischio/
        miglioria/assegnatario/revisore), instradato SUBITO da route()
        secondo la severity' Heinrich gia' calcolata dalla Regola 11 (MAI
        ricalcolata qui, vedi rule11.supporting_data -- riusa davvero il
        motore Kaizen esistente, non lo duplica). Se la Regola 11 non ha
        prodotto un esito valido (AI fallita, dato mancante) non crea
        nessuna comunicazione strutturata: non si puo' costruire uno schema
        con dati anti-allucinazione da un input che non li ha."""
        self.ensure_one()
        rule11 = self.rule_answer_ids.filtered(lambda a: a.rule_number == RULE11_NUMBER)
        if not rule11 or not rule11.supporting_data or rule11.supporting_data.get('flagged_missing_data') \
                or rule11.supporting_data.get('ai_call_failed') or rule11.supporting_data.get('ai_parse_failed'):
            _logger.info(
                "Segnale #%s: Regola 11 non disponibile/incompleta -- nessuna erpv6.agent.communication "
                "creata (non si costruisce uno schema con dati mancanti).", self.id)
            return False
        kaizen = self.env['erpv6.agent.config'].search([('code', '=', 'kaizen'), ('active', '=', True)], limit=1)
        if not kaizen:
            return False
        target_model, target_id = self._resolve_notify_target()
        if not target_model:
            return False
        admin = self.env.ref('base.user_admin', raise_if_not_found=False)
        if not admin:
            _logger.warning(
                "Nessun utente admin trovato -- comunicazione strutturata NON creata per segnale #%s "
                "(revisore mancante, mai lasciato implicito).", self.id)
            return False
        data = rule11.supporting_data
        severity = data.get('heinrich_severity')
        if severity not in ('near_miss', 'lieve', 'grave'):
            _logger.warning(
                "Segnale #%s: severity Heinrich '%s' fuori vocabolario -- nessuna comunicazione "
                "strutturata creata.", self.id, severity)
            return False
        return self.env['erpv6.agent.communication'].create_and_route({
            'agent_config_id': kaizen.id,
            'occurred_at': self.rules_evaluated_at or fields.Datetime.now(),
            'action_in_progress': _(
                "Applicazione delle 12 Regole Kaizen al segnale '%s' (sensore automatico o "
                "segnalazione manuale)."
            ) % self.signal_key,
            'problem_description': _("Segnale rilevato su %(model)s#%(id)s: chiave '%(key)s'.") % {
                'model': self.res_model, 'id': self.res_id, 'key': self.signal_key},
            'heinrich_severity': severity,
            'heinrich_indicator_id': data.get('heinrich_indicator_id'),
            'pareto_analysis_id': data.get('pareto_analysis_id'),
            'kairos_matrix_id': data.get('kairos_matrix_id'),
            'evaluation_notes': rule11.answer_text,
            'outcome_if_resolved': _(
                "Voce di changelog tecnico già scritta in Knowledge Base: '%(kb)s' (report completo "
                "in erpv6.library.document #%(doc)s)."
            ) % {'kb': kb_entry.name, 'doc': self.fix_document_id.id if self.fix_document_id else '?'},
            'risk_if_nothing_done': _(
                "Il problema segnalato resta senza una decisione umana esplicita: nessuna traccia di "
                "chi deve intervenire ne' di chi deve verificare, oltre al solo changelog tecnico."
            ),
            'proposed_improvement': kb_entry.content,
            'assignee_agent_id': kaizen.id,
            'reviewer_user_id': admin.id,
            'res_model': target_model, 'res_id': target_id,
        })
