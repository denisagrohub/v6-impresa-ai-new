import logging

from odoo import _, api, fields, models
from odoo.tools.safe_eval import safe_eval

_logger = logging.getLogger(__name__)


class Erpv6AgentMonitorRule(models.Model):
    """Motore di monitoraggio ATTIVO generico (Compito 1, 23/08/2026):
    "ogni agente deve avere un proprio motore di monitoraggio attivo sul
    proprio dominio, stesso pattern del motore Kaizen (cron che ispeziona
    dati reali, trova segnali, li valuta) ma parametrizzato per dominio --
    NON un motore diverso per ognuno, lo stesso motore generico riusato con
    un 'cosa guardare' diverso per agente". Il motore Kaizen esistente
    (erpv6_kaizen/models/kaizen_detected_signal.py) resta INVARIATO (non
    toccato, gia' collaudato, con la sua pipeline di 12 Regole dedicata) --
    questo e' un SECONDO motore, piu' semplice, generico per costruzione,
    per gli agenti che non hanno (ancora) bisogno delle 12 Regole: ogni
    'cosa guardare' e' UNA riga qui (res_model + domain di ricerca), non
    una riga di codice Python dedicata -- un nuovo controllo per un agente
    si aggiunge con un nuovo record, non con un nuovo metodo.

    Ogni record trovato dal domain diventa una erpv6.agent.communication
    (Compito 4) instradata subito da route() secondo la severity Heinrich
    configurata sulla regola (Compito 3) -- riusa DAVVERO l'infrastruttura
    appena costruita stasera, non la duplica."""
    _name = 'erpv6.agent.monitor.rule'
    _description = 'Regola di Monitoraggio Attivo di un Agente (motore generico)'
    _order = 'agent_config_id, name'

    name = fields.Char(string='Nome Regola', required=True)
    agent_config_id = fields.Many2one('erpv6.agent.config', string='Agente', required=True, ondelete='cascade')
    active = fields.Boolean(default=True)

    res_model = fields.Char(string='Modello da Ispezionare', required=True)
    domain = fields.Char(
        string='Domain di Ricerca', required=True, default='[]',
        help="Domain Odoo standard (sintassi Python, safe_eval) che identifica i record da segnalare "
             "-- es. \"[('typst_source','in',[False,''])]\". Nessuna finestra temporale relativa "
             "dinamica supportata qui (mai 'adesso meno N ore' dentro un domain statico): se serve, "
             "usare un campo booleano/computed sul modello target invece di un valore relativo.")
    signal_key = fields.Char(
        string='Chiave Segnale', required=True,
        help="Stabile e univoca per questa regola -- usata per il dedup (erpv6.agent.monitor.signal): "
             "lo stesso record non genera una seconda comunicazione finche' resta nel domain.")
    heinrich_severity = fields.Selection([
        ('near_miss', 'Near Miss'), ('lieve', 'Lieve'), ('grave', 'Grave'),
    ], string='Valutazione Heinrich', required=True, default='lieve',
        help="Fissa per questa regola (non calcolata dinamicamente, a differenza del motore Kaizen a "
             "12 Regole) -- guida comunque lo stesso routing del Compito 3.")

    outcome_hint = fields.Text(string='Cosa Crea (se risolto)', required=True)
    risk_hint = fields.Text(string='Cosa Cambia se Non si Fa Nulla', required=True)
    improvement_hint = fields.Text(string='Miglioria Proposta (generica)', required=True)

    _sql_constraints = [
        ('uniq_signal_key', 'UNIQUE(signal_key)', "Esiste gia' una regola con questa chiave segnale."),
    ]

    def _run(self):
        """UN giro di questa regola: cerca i record nel domain, per ognuno
        MAI gia' segnalato (dedup su erpv6.agent.monitor.signal) crea+
        instrada una erpv6.agent.communication. Un errore su UN record
        (es. display_name che solleva un'eccezione) non blocca gli altri --
        stesso principio di isolamento gia' seguito ovunque nel progetto."""
        self.ensure_one()
        admin = self.env.ref('base.user_admin', raise_if_not_found=False)
        if not admin:
            _logger.warning("Regola %s: nessun utente admin trovato, impossibile assegnare un revisore.", self.name)
            return 0
        try:
            domain = safe_eval(self.domain)
            records = self.env[self.res_model].search(domain)
        except Exception:
            _logger.exception("Regola %s: domain/ricerca non valida (%s su %s).", self.name, self.domain, self.res_model)
            return 0
        Signal = self.env['erpv6.agent.monitor.signal']
        new_count = 0
        for record in records:
            if Signal._already_detected(self.res_model, record.id, self.signal_key):
                continue
            try:
                target_model, target_id = self._resolve_thread_target(record)
                if not target_model:
                    _logger.warning(
                        "Regola %s: %s#%s non ha nessun thread valido (ne' mail.thread proprio ne' "
                        "un'ancora di fallback) -- comunicazione non creata per questo record.",
                        self.name, self.res_model, record.id)
                    continue
                comm = self.env['erpv6.agent.communication'].create_and_route({
                    'agent_config_id': self.agent_config_id.id,
                    'action_in_progress': _("Monitoraggio attivo del dominio — regola '%s'.") % self.name,
                    'problem_description': _("Trovato: %(rec)s (%(model)s#%(id)s), corrisponde alla regola '%(rule)s'.") % {
                        'rec': record.display_name, 'model': self.res_model, 'id': record.id, 'rule': self.name},
                    'heinrich_severity': self.heinrich_severity,
                    'outcome_if_resolved': self.outcome_hint,
                    'risk_if_nothing_done': self.risk_hint,
                    'proposed_improvement': self.improvement_hint,
                    'assignee_agent_id': self.agent_config_id.id,
                    'reviewer_user_id': admin.id,
                    'res_model': target_model, 'res_id': target_id,
                })
                Signal.create({
                    'rule_id': self.id, 'res_model': self.res_model, 'res_id': record.id,
                    'signal_key': self.signal_key, 'communication_id': comm.id,
                })
                new_count += 1
            except Exception:
                _logger.exception(
                    "Regola %s: creazione comunicazione fallita per %s#%s -- record isolato, gli altri "
                    "proseguono.", self.name, self.res_model, record.id)
        return new_count

    def _resolve_thread_target(self, record):
        """erpv6.agent.communication (via notify_pending_confirmation) ha
        bisogno di un record che supporti mail.thread (message_notify) --
        NON tutti i modelli ispezionabili lo sono (es. erpv6.production.phase
        e' un catalogo di configurazione, nessun chatter). Se il record
        segnalato lo supporta, si usa direttamente (thread piu' preciso: si
        vede l'avviso proprio li'); altrimenti si ricade sullo stesso lead
        fisso 'Amministrazione KB' gia' usato ovunque nel progetto per la
        corrispondenza interna non legata a un record specifico (stesso
        principio di erpv6_kaizen/models/kaizen_rule_engine.py._resolve_notify_target,
        NON duplicato qui in Python: solo lo stesso xmlid, con
        raise_if_not_found=False -- erpv6_agent non dipende formalmente da
        erpv6_production, e' vero il contrario, quindi questo resta un
        fallback opzionale, mai un requisito rigido)."""
        self.ensure_one()
        if hasattr(record, 'message_post'):
            return self.res_model, record.id
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        if kb_admin_lead:
            return 'crm.lead', kb_admin_lead.id
        return None, None

    # Seme di default (Compito 1, 23/08/2026) SOLO per Sabrina -- corretto
    # il 23/08/2026 (audit "motore vs conoscenza"): le regole di Andrea e
    # Susanna erano qui in Python per lo stesso motivo, ma i loro
    # erpv6.agent.config HANNO un xml id stabile (agent_config_andrea,
    # agent_config_susanna, creati da <record> nei rispettivi file dati) --
    # spostate quindi come <record> dichiarativi veri in
    # data/agent_monitor_rules_data.xml, coerenti col resto del modulo.
    #
    # Questa resta invece Python: Sabrina NON ha un xml id stabile
    # (verificato dal vivo il 23/08/2026: nessuna riga in ir_model_data per
    # erpv6.agent.config code='sabrina' -- creata a mano/da un'altra
    # sessione, mai passata da un <record> XML), quindi non esiste nessun
    # xml id a cui fare ref() per lei in un <record> statico. Get-or-create
    # su signal_key (idempotente, richiamabile ad ogni upgrade del modulo
    # senza duplicare), via ricerca su code invece che su xml id.
    _DEFAULT_RULES = [
        {
            'agent_code': 'sabrina',
            'name': "Sabrina — vocabolario grafo proposto ma mai attivato",
            'res_model': 'erpv6.kg.triple.shape',
            'domain': "[('source', '=', 'discovery_proposal'), ('is_active', '=', False)]",
            'signal_key': 'sabrina_shape_proposal_pending',
            'heinrich_severity': 'near_miss',
            'outcome_hint': "Il vocabolario del grafo si arricchisce di una shape verificata da un umano (attivata o scartata consapevolmente).",
            'risk_hint': "La shape proposta resta invisibile all'estrazione KB (mai usata finché non è attiva): il gap di copertura che l'ha generata resta aperto.",
            'improvement_hint': "Verifica la shape proposta (subject_type/predicate/object_type) e attivala se corretta, o scartala con una nota se non lo è.",
        },
    ]

    @api.model
    def _ensure_seed_rules(self):
        """Get-or-create sulla regola di default sopra (solo Sabrina, vedi
        commento su _DEFAULT_RULES -- Andrea/Susanna sono ora <record> XML
        veri in data/agent_monitor_rules_data.xml) -- idempotente,
        richiamabile ad ogni upgrade del modulo (chiamata da un <function>
        in data/agent_monitor_data.xml, noupdate='0' per costruzione: deve
        poter girare di nuovo se l'agente viene ricreato)."""
        AgentConfig = self.env['erpv6.agent.config']
        for spec in self._DEFAULT_RULES:
            if self.search_count([('signal_key', '=', spec['signal_key'])]):
                continue
            agent = AgentConfig.search([('code', '=', spec['agent_code'])], limit=1)
            if not agent:
                _logger.warning(
                    "Seed regola di monitoraggio '%s' saltato: agente '%s' non trovato.",
                    spec['name'], spec['agent_code'])
                continue
            self.create({
                'name': spec['name'], 'agent_config_id': agent.id, 'res_model': spec['res_model'],
                'domain': spec['domain'], 'signal_key': spec['signal_key'],
                'heinrich_severity': spec['heinrich_severity'], 'outcome_hint': spec['outcome_hint'],
                'risk_hint': spec['risk_hint'], 'improvement_hint': spec['improvement_hint'],
            })

    @api.model
    def _cron_run_all(self):
        """Cron condiviso (stesso principio di tutti gli altri cron
        generici del modulo): esegue TUTTE le regole attive, di qualunque
        agente -- una nuova regola per un agente futuro viene eseguita
        automaticamente al prossimo giro, senza aggiungere nessun cron
        XML dedicato."""
        rules = self.search([('active', '=', True)])
        for rule in rules:
            try:
                rule._run()
            except Exception:
                _logger.exception("Motore di monitoraggio: regola %s fallita per intero -- riprovera' al prossimo giro.", rule.name)


class Erpv6AgentMonitorSignal(models.Model):
    """Registro di dedup del motore generico -- stesso identico principio
    di erpv6.kaizen.detected_signal (evita di ri-segnalare lo stesso
    record ad ogni giro del cron), ma per il motore semplice del Compito 1,
    non per la pipeline a 12 Regole di Kaizen (che resta sul suo proprio
    registro, non toccato)."""
    _name = 'erpv6.agent.monitor.signal'
    _description = 'Segnale gia\' rilevato dal motore di monitoraggio generico (evita doppio conteggio)'

    rule_id = fields.Many2one('erpv6.agent.monitor.rule', string='Regola', required=True, ondelete='cascade')
    res_model = fields.Char(required=True, index=True)
    res_id = fields.Integer(required=True, index=True)
    signal_key = fields.Char(required=True, index=True)
    detected_at = fields.Datetime(default=fields.Datetime.now)
    communication_id = fields.Many2one('erpv6.agent.communication', string='Comunicazione Generata', ondelete='set null')

    _sql_constraints = [
        ('uniq_signal', 'UNIQUE(res_model, res_id, signal_key)',
         'Questo segnale è già stato rilevato per questo record.'),
    ]

    def _already_detected(self, res_model, res_id, signal_key):
        return bool(self.search_count([
            ('res_model', '=', res_model), ('res_id', '=', res_id), ('signal_key', '=', signal_key),
        ]))
