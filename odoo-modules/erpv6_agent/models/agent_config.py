import json
import logging

from odoo import _, api, fields, models
from odoo.tools import html2plaintext

_logger = logging.getLogger(__name__)

# Categoria KB CONDIVISA da tutti gli agenti per la loro memoria (aggiunta
# su richiesta esplicita dell'utente il 20/08/2026: "anche l'agente piu'
# semplice deve avere una sua memoria... allocata su KB divisa per agenti
# dentro una stessa categoria ed interrogabile"). Una sola categoria, non
# una per agente: le voci si distinguono per agente tramite un tag
# erpv6.kb.tag col codice dell'agente (get_or_create, stesso pattern gia'
# usato per le categorie), cosi' restano tutte interrogabili insieme O
# filtrate per singolo agente dalla stessa vista KB.
AGENT_MEMORY_CATEGORY_NAME = 'Memoria Agenti'
AGENT_MEMORY_MAX_ENTRIES = 10


class Erpv6AgentConfig(models.Model):
    """Registro degli agenti AI del sistema: base comune estratta da
    kaizen_agent.py (erpv6_kaizen, primo agente reale) su richiesta
    esplicita dell'utente il 20/08/2026 ("gli agenti hanno vita in un
    modulo a se'?"). Un agente qui e' SOLO la sua identita' + dove trova le
    istruzioni (una categoria KB) + quale route erpv6_omni_bridge chiamare.

    context_category_id e pattern_id (aggiunti dopo, stessa sessione, su
    richiesta "Thor sceglie tra pattern gia' pronti e li configura da
    solo"): se un agente ha pattern_id.code='text_proposal' e
    context_category_id valorizzato, _run_generic_text_proposal lo esegue
    SENZA bisogno di nessun codice Python scritto apposta -- vedi
    _cron_run_generic_agents sotto. Kaizen resta sul suo cron dedicato
    (kaizen_agent.py, gia' collaudato) e non usa questo motore generico:
    non toccato per non rischiare di romperlo, ma classificato con lo
    stesso pattern_id per coerenza."""
    _name = 'erpv6.agent.config'
    _description = 'Configurazione Agente AI'
    _order = 'name'

    name = fields.Char(string='Nome', required=True)
    code = fields.Char(string='Codice', required=True, help="Slug tecnico stabile, es. 'kaizen'. Usato dal codice per trovare questo agente.")
    pattern_id = fields.Many2one('erpv6.agent.pattern', string='Pattern')
    instructions_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB Istruzioni', required=True,
        help="Le voci KB di questa categoria vengono lette come istruzioni di sistema per l'agente "
             "(stesso pattern gia' usato per 'Regole Kaizen').",
    )
    context_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB Contesto/Fatti',
        help="Solo per pattern 'text_proposal': le voci KB di questa categoria vengono lette come "
             "i fatti/lo stato attuale su cui l'agente deve ragionare (es. per Kaizen sarebbero il "
             "backlog Pareto e l'aggregato Heinrich, ma Kaizen resta sul suo cron dedicato). Un "
             "agente creato da Thor senza codice Python usa SOLO questo campo per sapere di cosa "
             "parlare -- tenerlo aggiornato (a mano o da un altro cron) e' responsabilita' di chi "
             "lo configura.",
    )
    omni_task_type = fields.Char(
        string='Task Type erpv6_omni_bridge', required=True,
        help="task_type della route erpv6.omni.route.config da chiamare per questo agente.",
    )
    persona_kb_id = fields.Many2one(
        'erpv6.kb', string='Persona (tono, professione, capacità)',
        help="UNA voce KB (non una categoria: tono/professione/capacità sono di solito un blocco "
             "coerente, non una lista di regole separate) che descrive chi e' l'agente, come parla, "
             "cosa sa fare. Facoltativa ma consigliata -- senza, l'agente ha istruzioni e contesto "
             "ma nessuna voce propria.",
    )
    partner_id = fields.Many2one(
        'res.partner', string='Identità (mittente messaggi)',
        help="Contatto dedicato usato come autore quando questo agente scrive un messaggio nel "
             "chatter di un record (vedi notify_pending_confirmation) -- cosi' il messaggio compare "
             "col nome dell'agente, non con OdooBot o l'utente admin del cron. Facoltativo: senza, "
             "si usa l'utente che esegue il codice (di solito l'admin del cron). Aggiunto il "
             "22/08/2026 per l'agente Sabrina, generico per qualunque agente futuro.",
    )
    notify_partner_ids = fields.Many2many(
        'res.partner', string='Destinatari notifiche',
        help="A CHI scrive questo agente (vedi notify_pending_confirmation) - vuoto = ricade "
             "sull'admin/Denis (comportamento di sempre). Aggiunto il 24/08/2026 su richiesta "
             "esplicita di Denis, pensando ad agenti futuri con un pubblico diverso da lui (es. "
             "'Anna la commercialista' scriverebbe a chi in azienda fa il lavoro contabile, non a "
             "Denis): un dato configurabile per agente, mai un contatto fisso scritto nel codice.",
    )
    active = fields.Boolean(default=True)
    description = fields.Text(string='Descrizione')
    escalation_minutes = fields.Integer(
        string='Minuti prima di Escalation', default=5,
        help="SLA di processo: dopo quanti minuti una erpv6.agent.confirmation ancora 'pending' "
             "riceve un promemoria di escalation (vedi erpv6.agent.confirmation._cron_check_escalations). "
             "Oggi ha senso solo sul record di Susanna (l'unica che scrive promemoria di escalation, "
             "mai gli altri agenti) -- campo qui su erpv6.agent.config, non una costante Python, "
             "perche' e' questo il modello di configurazione condiviso degli agenti (corretto il "
             "23/08/2026, audit 'motore vs conoscenza': prima era AGENT_CONFIRMATION_ESCALATION_MINUTES, "
             "una costante fissa in agent_confirmation.py, duplicata anche come testo fisso "
             "\"5 minuti\" nella persona di Susanna -- vedi _get_persona_text, che ora la sostituisce "
             "a runtime invece di lasciarla ripetuta a mano)."
    )
    discuss_channel_id = fields.Many2one(
        'discuss.channel', string='Canale Discuss', readonly=True, copy=False,
        help="Compito 2 (23/08/2026): canale Discuss diretto (channel_type='chat') tra questo agente "
             "e Denis, creato/trovato da _ensure_discuss_channel() -- NON serve un res.users per "
             "l'agente (verificato dal vivo il 23/08/2026: discuss.channel.channel_get() pinna il "
             "canale per chi lo chiama usando solo partner_id, la controparte puo' essere un "
             "res.partner senza utente collegato). Vuoto solo se partner_id non e' ancora valorizzato "
             "o se _ensure_discuss_channel() non e' ancora stato chiamato.")

    _sql_constraints = [
        ('uniq_code', 'UNIQUE(code)', "Esiste gia' un agente con questo codice."),
    ]

    def _get_memory_tag(self):
        """Tag erpv6.kb.tag col codice di questo agente (get-or-create,
        stesso idioma gia' usato per le categorie KB): distingue le voci di
        AGENT_MEMORY_CATEGORY_NAME appartenenti a questo agente dalle
        altre, senza bisogno di una categoria per agente."""
        self.ensure_one()
        Tag = self.env['erpv6.kb.tag']
        tag = Tag.search([('name', '=', self.code)], limit=1)
        return tag or Tag.create({'name': self.code})

    def _get_memory_kbs(self):
        """Le ultime AGENT_MEMORY_MAX_ENTRIES voci di memoria di questo
        agente, piu' recenti prima -- un tetto fisso perche' la memoria
        cresce ad ogni proposta e non deve far crescere il prompt AI senza
        limite (stesso principio di attenzione alla crescita gia' discusso
        stasera per erpv6.kaizen.detected_signal)."""
        self.ensure_one()
        category = self.env['erpv6.kb.category'].get_or_create(
            AGENT_MEMORY_CATEGORY_NAME, 'metodo_v6', is_transversal=True)
        tag = self._get_memory_tag()
        return self.env['erpv6.kb'].search(
            [('category_id', '=', category.id), ('tag_ids', 'in', tag.id), ('is_active', '=', True)],
            order='create_date desc', limit=AGENT_MEMORY_MAX_ENTRIES)

    def _write_memory(self, summary):
        """Aggiunge una voce alla memoria di questo agente -- chiamata dopo
        ogni proposta generata con successo, cosi' il giro successivo la
        rilegge (vedi _get_memory_kbs) e l'agente diventa via via piu'
        istruito sul proprio storico, non solo su istruzioni/contesto
        statici."""
        self.ensure_one()
        category = self.env['erpv6.kb.category'].get_or_create(
            AGENT_MEMORY_CATEGORY_NAME, 'metodo_v6', is_transversal=True)
        tag = self._get_memory_tag()
        self.env['erpv6.kb'].create({
            'name': "%s - %s" % (self.name, fields.Datetime.now()),
            'kb_type': 'metodo_v6',
            'category_id': category.id,
            'tag_ids': [(6, 0, [tag.id])],
            'agent_config_id': self.id,
            'content': summary,
            'content_format': 'text',
            'access_level': 'ai_only',
            'is_active': True,
        })

    def _default_notify_partner_ids(self):
        """Destinatario di default per una notifica REALE (message_notify,
        non solo chatter) quando il chiamante non specifica esplicitamente
        notify_partner_ids. Non piu' @api.model dal 24/08/2026 (richiesto
        esplicitamente da Denis: contatti configurabili per agente, non
        fissi su di lui - pensando ad agenti futuri come "Anna la
        commercialista" che scriverebbe a chi fa contabilita', non a
        Denis): se questo agente ha notify_partner_ids valorizzato, quello
        vince; altrimenti ricade sull'admin/Denis come sempre (record
        vuoto, es. chiamato su self.env['erpv6.agent.config'] senza un
        agente specifico, si comporta esattamente come prima)."""
        if self and self.notify_partner_ids:
            return self.notify_partner_ids.ids
        admin_user = self.env.ref('base.user_admin', raise_if_not_found=False)
        return admin_user.partner_id.ids if admin_user else []

    @api.model
    def _notify_email_from_kwargs(self):
        """email_from esplicito per message_notify -- senza, finirebbe con
        mittente 'OdooBot <odoobot@example.com>' invece del mittente
        aziendale (mail.default.from). Stesso fix gia' applicato piu' volte
        nel progetto (digest, certificato, agent_proposal.py._do_accept)."""
        default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from')
        if not default_from:
            return {}
        return {'email_from': '"%s" <%s>' % (self.env.company.name, default_from)}

    @api.model
    def _notify_or_post(self, record, partner_ids, subject, body, author_id):
        """Wrapper condiviso attorno a message_notify -- usato da
        notify_pending_confirmation QUI e da erpv6.agent.confirmation (ack
        di conferma, risposta conversazionale) per la stessa correzione del
        bug 'notifica invisibile' del 22/08/2026 (vedi
        notify_pending_confirmation per i dettagli del bug trovato).
        message_notify(partner_ids=[]) non crea NESSUN messaggio -- solo un
        warning nei log del core Odoo, mai un errore: mai accettabile
        qui, un messaggio non deve mai sparire in silenzio. Se non c'e'
        nessun destinatario risolvibile, ricade su message_post cosi' il
        messaggio esiste comunque (visibile nel chatter), con un log
        esplicito che la notifica reale manca."""
        notify_kwargs = self._notify_email_from_kwargs()
        if partner_ids:
            return record.message_notify(
                partner_ids=partner_ids, subject=subject, body=body, author_id=author_id, **notify_kwargs)
        _logger.warning(
            "Nessun destinatario risolvibile per la notifica '%s' su %s#%s -- scritto solo nel "
            "chatter, nessuna notifica reale inviata.", subject, record._name, record.id)
        return record.message_post(body=body, subject=subject, author_id=author_id)

    def _get_persona_text(self):
        """Testo della persona (persona_kb_id.content) con eventuali
        placeholder sostituiti da campi REALI di questo agente -- oggi
        solo '{escalation_minutes}' (Susanna, vedi campo escalation_minutes
        sopra), ma generico per costruzione: qualunque persona futura puo'
        usare lo stesso placeholder senza bisogno di nuovo codice. Corretto
        il 23/08/2026 (audit 'motore vs conoscenza'): prima il testo della
        persona di Susanna ripeteva "5 minuti" come stringa fissa, separata
        e non collegata alla costante Python che decideva davvero la
        soglia -- le due potevano disallinearsi silenziosamente. Una
        semplice sostituzione letterale (mai .format(), per non rompere su
        eventuali altre graffe nel testo libero della persona) invece di un
        motore di templating: e' l'unico placeholder che serve oggi."""
        self.ensure_one()
        text = self.persona_kb_id.content if self.persona_kb_id else ''
        if text and '{escalation_minutes}' in text:
            text = text.replace('{escalation_minutes}', str(self.escalation_minutes))
        return text

    def _compose_notice_text(self, title, facts_text):
        """Genera il testo di un avviso IN VOCE PROPRIA (persona + istruzioni
        di questo agente), mai un template di sistema anonimo -- aggiunto il
        22/08/2026 per Sabrina ("Sabrina scrive lei le notifiche, non un
        messaggio generico di sistema"), ma generico per qualunque agente.
        I FATTI (facts_text) sono sempre forniti dal chiamante, mai inventati
        qui: l'AI puo' solo scegliere come formularli, non aggiungerne di
        nuovi (stessa regola anti-allucinazione del resto del progetto).
        Se la chiamata AI fallisce, non blocca l'avviso: ricade su un testo
        deterministico chiaro, mai silenzioso."""
        self.ensure_one()
        fallback = _("%(title)s\n\n%(facts)s") % {'title': title, 'facts': facts_text}
        if not self.omni_task_type:
            return fallback
        persona_text = self._get_persona_text()
        instructions_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', self.instructions_category_id.id), ('is_active', '=', True)], order='name') \
            if self.instructions_category_id else self.env['erpv6.kb']
        instructions_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in instructions_kbs)
        system_prompt = (
            "Sei l'agente '%(name)s' del sistema erpv6.%(persona)s Devi scrivere un breve avviso in "
            "italiano per un umano, nel tuo tono/persona, basato SOLO sui fatti forniti sotto -- non "
            "aggiungere nessun fatto non presente, non inventare numeri o dettagli. Rispondi SOLO con "
            "un oggetto JSON valido, senza markdown code fence, senza altro testo: "
            '{"message": "<avviso breve, diretto, nel tuo tono>"}\n\n'
            "%(instructions)s"
        ) % {
            'name': self.name,
            'persona': (" " + persona_text) if persona_text else '',
            'instructions': ("ISTRUZIONI:\n%s\n\n" % instructions_text) if instructions_text else '',
        }
        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type=self.omni_task_type,
            payload={
                'temperature': 0.3,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': _("TITOLO: %(title)s\n\nFATTI:\n%(facts)s") % {
                        'title': title, 'facts': facts_text}},
                ],
            },
            context={'source': 'erpv6_agent:_compose_notice_text', 'agent_code': self.code},
        )
        if not result.get('success'):
            _logger.warning("Agente %s: chiamata AI fallita per formulare l'avviso, uso testo grezzo: %s", self.code, result.get('error'))
            return fallback
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
            message = parsed.get('message')
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning("Agente %s: risposta AI in formato inatteso per l'avviso, uso testo grezzo: %s", self.code, e)
            return fallback
        if not message:
            return fallback
        return message

    def _compute_live_briefing(self):
        """Dati REALI (mai inventati/riassunti a memoria) su piu' domini
        dell'attivita' di Denis, SOLO per Susanna (24/08/2026, richiesto
        esplicitamente: "deve vedere tutto di me essendo la mia assistente"
        -- non accesso grezzo, capacita' di rispondere subito su dove
        stanno le cose, stesso ruolo di una vera segretaria/EA). Ogni
        agente futuro che ne avesse bisogno puo' estendere qui (dispatch su
        self.code, stesso pattern gia' in uso altrove in questo file) --
        non un meccanismo per-agente separato duplicato. Sola lettura,
        sempre: nessuna scrittura, nessuna azione, solo query dirette al
        momento della domanda cosi' il dato e' sempre fresco."""
        self.ensure_one()
        if self.code != 'susanna':
            return ''
        sections = []

        admin = self.env.ref('base.user_admin', raise_if_not_found=False)
        if admin:
            activities = self.env['mail.activity'].sudo().search(
                [('user_id', '=', admin.id)], limit=10, order='date_deadline')
            if activities:
                lines = ["- %s (%s, scadenza %s)" % (
                    a.summary or a.res_name or ('%s #%d' % (a.res_model, a.res_id)),
                    a.res_model, a.date_deadline) for a in activities]
                sections.append("ATTIVITÀ APERTE DI DENIS (%d):\n%s" % (len(activities), "\n".join(lines)))
            else:
                sections.append("ATTIVITÀ APERTE DI DENIS: nessuna.")

        leads = self.env['crm.lead'].sudo().search(
            [('type', '=', 'opportunity'), ('active', '=', True)], limit=8, order='write_date desc')
        if leads:
            lines = ["- #%d %s (fase: %s)" % (l.id, l.name, l.stage_id.name if l.stage_id else '?') for l in leads]
            sections.append("OPPORTUNITÀ ATTIVE RECENTI (%d mostrate):\n%s" % (len(leads), "\n".join(lines)))

        if 'erpv6.production.order' in self.env:
            productions = self.env['erpv6.production.order'].sudo().search(
                [], limit=8, order='write_date desc')
            if productions:
                lines = ["- #%d %s (fase: %s)" % (
                    p.id, p.lead_id.name or '?', p.phase_id.name if p.phase_id else '?') for p in productions]
                sections.append("PRODUZIONI RECENTI (%d mostrate):\n%s" % (len(productions), "\n".join(lines)))

        proposals = self.env['erpv6.agent.proposal'].sudo().search(
            [('status', '=', 'pending_review')], limit=10, order='create_date desc')
        if proposals:
            lines = ["- #%d [%s] %s" % (p.id, p.agent_config_id.name, p.name) for p in proposals]
            sections.append("PROPOSTE IN ATTESA DI DECISIONE (%d):\n%s" % (len(proposals), "\n".join(lines)))
        else:
            sections.append("PROPOSTE IN ATTESA DI DECISIONE: nessuna.")

        comms = self.env['erpv6.agent.communication'].sudo().search(
            [], limit=8, order='create_date desc')
        if comms:
            lines = ["- #%d %s (%s, agente %s)" % (
                c.id, c.name, c.routing_state, c.agent_config_id.name) for c in comms]
            sections.append("COMUNICAZIONI RECENTI DEGLI AGENTI (%d mostrate):\n%s" % (len(comms), "\n".join(lines)))

        log_kb = self.env['erpv6.kb'].sudo().search(
            [('name', '=', 'Registro Attività Agenti Esterni (sync automatico)')], limit=1)
        if log_kb and log_kb.content:
            # Solo le ultime righe (il file cresce nel tempo, non serve
            # tutto lo storico in ogni singola risposta di Susanna).
            tail = "\n".join(log_kb.content.strip().splitlines()[-15:])
            sections.append("ULTIME ATTIVITÀ DI CLAUDIO/ARGUS (coda del registro):\n%s" % tail)

        return "\n\n".join(sections)

    # Parole chiave per il recupero dati diretto (24/08/2026, richiesto
    # esplicitamente da Denis: "Susanna dovrebbe girare in Odoo senza
    # consumare troppe chiamate AI, i dati sono dentro Odoo") - stesso
    # principio non negoziabile del match per parola chiave esplicita, MAI
    # un giudizio "sembra una domanda sui dati": se nessuna di queste
    # compare, si passa comunque all'AI, mai un rifiuto silenzioso.
    DIRECT_DATA_KEYWORDS = (
        'notifiche', 'appuntamenti', 'programma', 'attività', 'attivita',
        'proposte', 'in sospeso', 'in attesa', 'aggiornami', 'situazione',
    )

    def _try_direct_data_answer(self, question_text):
        """SOLO per Susanna: se la domanda e' chiaramente un recupero dati
        (parola chiave esplicita, vedi DIRECT_DATA_KEYWORDS), risponde
        DIRETTAMENTE col briefing live gia' calcolato -- ZERO chiamate AI,
        zero rischio di 429/rate limit, dato sempre fresco perche' letto
        ora. Solo per domande genuinamente aperte (serve capire/formulare,
        non solo recuperare) si passa all'AI in answer_conversationally.
        Ritorna None (mai stringa vuota) se non e' il caso, cosi' il
        chiamante sa distinguere "bypass non applicabile" da "bypass
        applicato ma senza contenuto"."""
        self.ensure_one()
        if self.code != 'susanna':
            return None
        text_lower = question_text.lower()
        if not any(kw in text_lower for kw in self.DIRECT_DATA_KEYWORDS):
            return None
        briefing = self._compute_live_briefing()
        if not briefing:
            return _("Non ho trovato dati da mostrarti al momento.")
        return _("Ecco la situazione reale, appena controllata:\n\n%s") % briefing

    def _consult_other_agent(self, question_text):
        """SOLO per Susanna (24/08/2026, richiesto esplicitamente: "quando
        attiva gli altri agenti gli altri devono risponderle subito e lei
        deve comunicarmi la risposta"). Riconoscimento per NOME esplicito
        menzionato nella domanda (mai interpretazione libera di quale
        agente "potrebbe" essere pertinente -- stesso principio non
        negoziabile gia' seguito per ogni azione degli agenti stasera):
        se Denis nomina un altro agente attivo per nome, quell'agente
        risponde DAVVERO (stessa answer_conversationally, sincrona, subito)
        e la sua risposta reale viene passata a Susanna per essere
        comunicata -- mai una risposta inventata a nome di un altro
        agente."""
        self.ensure_one()
        if self.code != 'susanna':
            return None
        others = self.env['erpv6.agent.config'].search([('code', '!=', 'susanna'), ('active', '=', True)])
        text_lower = question_text.lower()
        for other in others:
            if other.name and other.name.lower() in text_lower:
                try:
                    answer, _pending = other.answer_conversationally(
                        title=_("Richiesta di Denis via Susanna"),
                        thread_history='', question_text=question_text,
                    )
                except Exception:
                    _logger.exception("Consultazione di %s da parte di Susanna fallita.", other.code)
                    continue
                return (other, answer)
        return None

    def answer_conversationally(self, title, thread_history, question_text):
        """Genera una risposta conversazionale GENUINA (dialogo vero, non un
        template) a un messaggio umano scritto in un thread dove QUESTO
        agente ha gia' postato un avviso -- richiesto esplicitamente il
        22/08/2026 ("voglio poter dialogare con kaizen, come con sabrina,
        una cosa che faro' con tutti gli agenti"). Costruito qui su
        erpv6.agent.config (infrastruttura CONDIVISA), non nel modulo di un
        singolo agente: riusabile identico da Sabrina, Kaizen e qualunque
        agente futuro -- chi chiama e' erpv6.agent.confirmation._check_for_confirmation
        quando trova un messaggio umano che NON e' una delle parole chiave
        chiuse (AGENT_CONFIRM_KEYWORDS).

        Vincolo non negoziabile, ripetuto anche nel prompt sotto: questo
        metodo produce SOLO testo informativo, mai un'azione. Anche se dalla
        domanda dell'umano emergesse chiaramente il bisogno di un'azione
        concreta, la risposta deve indicare la parola chiave da scrivere per
        farla eseguire -- MAI dedurla/eseguirla da qui. L'azione predefinita
        resta gated esclusivamente dal match esatto sulla parola chiave
        chiusa (vedi erpv6.agent.confirmation._do_confirm), invariato."""
        self.ensure_one()
        fallback = _(
            "Ho ricevuto il tuo messaggio ma non sono riuscita a generare una risposta in questo "
            "momento -- riprova o chiedi di nuovo."
        )
        direct_answer = self._try_direct_data_answer(question_text)
        if direct_answer is not None:
            return direct_answer
        if not self.omni_task_type:
            return fallback
        persona_text = self._get_persona_text()
        instructions_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', self.instructions_category_id.id), ('is_active', '=', True)], order='name') \
            if self.instructions_category_id else self.env['erpv6.kb']
        instructions_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in instructions_kbs)
        live_briefing = self._compute_live_briefing()
        if live_briefing:
            instructions_text += "\n\n### Stato attuale (dati reali, interrogati ora)\n%s" % live_briefing
        consulted = self._consult_other_agent(question_text)
        if consulted:
            other, other_answer = consulted
            instructions_text += (
                "\n\n### Cosa direbbe %(agent)s su questo, appena interrogato con lo stesso "
                "meccanismo (SUA opinione/persona, NON un controllo dello stato reale del suo "
                "lavoro/backlog - %(agent)s non ha qui accesso a task/branch/proposte in corso "
                "diversi da quelli gia' elencati sopra in ISTRUZIONI)\n%(answer)s\n\n"
                "(Riporta questa risposta a Denis attribuendola chiaramente a %(agent)s, nel tuo "
                "tono, senza inventare nulla in più e SENZA presentarla come una verifica tecnica "
                "reale se non lo e'.)"
            ) % {'agent': other.name, 'answer': other_answer}
        system_prompt = (
            "Sei l'agente '%(name)s' del sistema erpv6.%(persona)s Un umano ti ha scritto un messaggio "
            "in una conversazione con te (contesto/titolo, se applicabile: '%(title)s' -- puo' essere "
            "un thread che hai aperto tu con un avviso, oppure una conversazione diretta che l'umano "
            "ha iniziato lui per primo: in entrambi i casi rispondi allo stesso modo). Rispondi in "
            "modo conversazionale, breve, in italiano, nel tuo tono -- basandoti SOLO sui fatti "
            "presenti nel tuo storico del thread e nelle tue istruzioni sotto, mai inventando dati non "
            "presenti (se non sai qualcosa, dillo esplicitamente invece di inventarlo).\n\n"
            "VINCOLO NON NEGOZIABILE (25/08/2026, rafforzato dopo un caso reale di Susanna che ha "
            "scritto \"ho inoltrato/trasmesso la richiesta\" senza che fosse MAI vero, per una "
            "richiesta libera senza nessun meccanismo gia' collegato): questa risposta e' SOLO "
            "testo informativo -- tu NON esegui, inoltri, trasmetti o deleghi MAI nulla scrivendo "
            "questo messaggio, nemmeno se l'umano lo chiede esplicitamente o da' per scontato che "
            "l'hai gia' fatto. Non scrivere MAI frasi come 'ho inoltrato', 'ho trasmesso', 'ho "
            "delegato', 'procedo subito' -- non e' vero, tu non hai nessun modo di eseguire nulla "
            "da qui. Due casi:\n"
            "1) Se l'azione e' GIA' collegata a un avviso esistente (una conferma con azione gia' "
            "agganciata), dì quale parola chiave chiusa scrivere (es. 'ok') per farla eseguire.\n"
            "2) Se invece la richiesta e' NUOVA e non esiste ancora nessun meccanismo automatico "
            "collegato (es. un nuovo consulente da creare, un nuovo modulo da sviluppare, una nuova "
            "regola): dillo chiaramente ('questo non ha ancora un collegamento automatico'), e SE "
            "la richiesta e' abbastanza concreta da valere la pena registrarla per davvero, valorizza "
            "anche 'azione_proposta' sotto (altrimenti lascialo null) -- la registrazione vera "
            "avviene SOLO se l'umano scrive poi la parola chiave 'registra', mai qui.\n\n"
            "VINCOLO NON NEGOZIABILE #2 (25/08/2026, richiesto esplicitamente): se per compilare "
            "'azione_proposta' ti mancano dati necessari o hai un dubbio reale su cosa l'umano "
            "intende, NON indovinare e NON compilarla comunque con un contenuto plausibile ma "
            "incompleto -- lascia 'azione_proposta' a null e usa 'message' per fare le domande "
            "precise che ti servono. Il tuo unico compito come AI e' tradurre in un linguaggio "
            "comprensibile cosa succederebbe, mai decidere al posto dell'umano quando manca "
            "l'informazione.\n\n"
            "Rispondi SOLO con un oggetto JSON valido, senza markdown code fence, senza altro testo: "
            '{"message": "<risposta breve, nel tuo tono>", "azione_proposta": null oppure '
            '{"tipo": "claudio|alessandro|kaizen_signal", "titolo": "<breve>", "descrizione": '
            '"<completa, con tutti i dettagli dati dall\'umano finora>"}}\n\n'
            "Come scegliere 'tipo' per azione_proposta: 'claudio' per qualunque compito concreto e "
            "ben definito che Claudio puo' davvero eseguire (accesso ampio a VPS/DB/Odoo via "
            "safe_exec.sh, non solo edit di file -- es. creare un consulente/partner/utente reale è "
            "un compito da Claudio, non da Kaizen, se i dati forniti bastano a farlo); 'alessandro' "
            "se è un task di codice/analisi ma il bersaglio preciso non è ancora chiaro (indagine "
            "prima necessaria); 'kaizen_signal' solo per idee di prodotto/processo senza un'azione "
            "diretta eseguibile (nuove regole di metodo, segnalazioni, miglioramenti da valutare) -- "
            "mai per un compito che Claudio potrebbe già fare con i dati che hai.\n\n"
            "%(instructions)s"
        ) % {
            'name': self.name,
            'persona': (" " + persona_text) if persona_text else '',
            'title': title,
            'instructions': ("ISTRUZIONI:\n%s\n\n" % instructions_text) if instructions_text else '',
        }
        user_content = _(
            "STORICO DEL THREAD FINORA:\n%(thread)s\n\nNUOVO MESSAGGIO DELL'UMANO A CUI RISPONDERE:\n"
            "%(question)s"
        ) % {'thread': thread_history or _('(nessuno)'), 'question': question_text}
        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type=self.omni_task_type,
            payload={
                'temperature': 0.3,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content},
                ],
            },
            context={'source': 'erpv6_agent:answer_conversationally', 'agent_code': self.code},
        )
        if not result.get('success'):
            _logger.warning(
                "Agente %s: chiamata AI fallita per la risposta conversazionale, uso testo di fallback: %s",
                self.code, result.get('error'))
            return fallback, None
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
            message = parsed.get('message')
            raw_action = parsed.get('azione_proposta')
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning(
                "Agente %s: risposta AI in formato inatteso per la risposta conversazionale, uso "
                "testo di fallback: %s", self.code, e)
            return fallback, None
        if not message:
            return fallback, None
        pending_action = None
        if isinstance(raw_action, dict) and raw_action.get('tipo') in ('claudio', 'alessandro', 'kaizen_signal'):
            pending_action = {
                'type': raw_action['tipo'],
                'title': raw_action.get('titolo') or message[:120],
                'description': raw_action.get('descrizione') or question_text,
            }
        return message, pending_action

    # ------------------------------------------------------------------
    # Dialogo iniziato dall'UMANO (non dall'agente) -- richiesto
    # esplicitamente il 22/08/2026: "voglio poter scrivere per primo a
    # qualunque agente... con TUTTI gli agenti, non solo uno". Canale
    # DIVERSO e AGGIUNTIVO rispetto a erpv6.agent.confirmation (quel
    # meccanismo resta ancorato a un thread di RECORD gia' avviato
    # dall'agente, res_model/res_id, con un'eventuale azione da
    # confermare) -- qui e' una chat diretta di Odoo Discuss
    # (discuss.channel, channel_type='chat') tra un umano e il partner_id
    # dell'agente, nessun record di business coinvolto, quindi nessuna
    # azione da confermare: OGNI messaggio umano nuovo genera sempre e
    # solo una risposta conversazionale via answer_conversationally
    # (stesso vincolo anti-azione, riusato cosi' com'e', nessuna logica
    # duplicata). Usa il watermark NATIVO di Odoo Discuss
    # (discuss.channel.member.seen_message_id per la riga di membership
    # dell'agente) invece di un campo/modello nuovo -- nessuna tabella
    # aggiuntiva necessaria per tracciare "fin dove ho gia' risposto".
    # ------------------------------------------------------------------

    @api.model
    def _cron_check_agent_direct_messages(self):
        """Cron condiviso (stesso principio di _cron_check_pending_confirmations
        in agent_confirmation.py): scansiona TUTTI gli agenti attivi con
        un'identita' (partner_id) -- un nuovo agente futuro (Andrea,
        Susanna, ...) e' coperto automaticamente non appena ha un
        partner_id, senza aggiungere nessun cron XML dedicato."""
        agents = self.search([('active', '=', True), ('partner_id', '!=', False)])
        for agent in agents:
            try:
                agent._check_direct_messages()
            except Exception:
                _logger.exception(
                    "Controllo messaggi diretti fallito per l'agente %s -- riprovera' al prossimo giro.",
                    agent.code)

    def _check_direct_messages(self):
        """Tutti i canali chat 1:1 (channel_type='chat') di cui il
        partner_id di questo agente e' membro -- normalmente uno per ogni
        umano che ha aperto una conversazione diretta con lui in Discuss
        (es. cliccando sul suo nome), ma il codice non assume un numero
        fisso."""
        self.ensure_one()
        Member = self.env['discuss.channel.member']
        agent_memberships = Member.sudo().search([
            ('partner_id', '=', self.partner_id.id),
            ('channel_id.channel_type', '=', 'chat'),
        ])
        for membership in agent_memberships:
            self._check_direct_messages_on_channel(membership)

    def _check_direct_messages_on_channel(self, membership):
        """Legge, su UN canale chat diretto, i messaggi umani nuovi dopo
        l'ultimo gia' visto (membership.seen_message_id, il watermark
        nativo di Discuss) e risponde ad ognuno in conversazione --
        aggiorna il watermark alla fine, cosi' il prossimo giro del cron
        non li rivaluta. Un messaggio vuoto o scritto da chi non ha un
        utente reale (bot/import) viene ignorato, stesso principio gia'
        seguito per le risposte sui thread di record."""
        self.ensure_one()
        channel = membership.channel_id
        Message = self.env['mail.message']
        after_id = membership.seen_message_id.id if membership.seen_message_id else 0
        candidates = Message.sudo().search([
            ('id', '>', after_id),
            ('model', '=', 'discuss.channel'),
            ('res_id', '=', channel.id),
            ('message_type', '=', 'comment'),
            ('author_id', '!=', self.partner_id.id),
        ], order='id asc')
        if not candidates:
            return
        last_id = after_id
        for msg in candidates:
            last_id = msg.id
            if not msg.author_id or not msg.author_id.user_ids:
                continue  # niente autore reale (bot/import) -> ignorato, stesso principio del resto
            question_text = html2plaintext(msg.body or '').strip()
            if not question_text:
                continue
            thread_history = self._compose_channel_history(channel, after_id, msg.id)
            answer, pending_action = self.answer_conversationally(
                title=_("Conversazione diretta con %s") % self.name,
                thread_history=thread_history, question_text=question_text)
            if pending_action:
                answer += _(
                    "\n\n(Per registrarla per davvero, scrivimi su Telegram \"registra\" — "
                    "qui su Discuss non è ancora collegato.)"
                )
            channel.sudo().message_post(
                body=answer.replace("\n", "<br/>"), author_id=self.partner_id.id,
                message_type='comment', subtype_xmlid='mail.mt_comment')
        membership.sudo().write({'seen_message_id': last_id})

    def _compose_channel_history(self, channel, after_id, up_to_id):
        """Ricostruisce il testo dello scambio su un canale Discuss diretto,
        stesso principio di erpv6.agent.confirmation._compose_thread_history
        ma su discuss.channel invece che sul chatter di un record -- l'AI
        deve vedere tutta la conversazione fin qui, non solo l'ultimo
        messaggio isolato."""
        self.ensure_one()
        Message = self.env['mail.message']
        messages = Message.sudo().search([
            ('id', '>', after_id),
            ('id', '<=', up_to_id),
            ('model', '=', 'discuss.channel'),
            ('res_id', '=', channel.id),
            ('message_type', '=', 'comment'),
        ], order='id asc')
        lines = []
        for m in messages:
            speaker = self.name if m.author_id.id == self.partner_id.id else (m.author_id.name if m.author_id else '?')
            lines.append("%s: %s" % (speaker, html2plaintext(m.body or '').strip()))
        return "\n".join(lines)

    def notify_pending_confirmation(self, title, facts, res_model, res_id,
                                     action_model=None, action_res_id=None, action_method=None,
                                     notify_partner_ids=None):
        """Meccanismo GENERICO (riusabile da qualunque agente/pezzo di
        codice, non solo dal rilevatore vocabolario KG) per: scrivere un
        avviso in voce propria sul thread di un record specifico
        (res_model/res_id, deve supportare mail.thread), e tracciare che
        quell'avviso resta in attesa di una conferma umana ESPLICITA nello
        STESSO thread (vedi erpv6.agent.confirmation._cron_check_pending_confirmations)
        prima di eseguire una qualunque azione.

        L'azione predefinita da eseguire alla conferma (action_model/
        action_res_id/action_method: il nome di un metodo senza argomenti
        da chiamare su quel record) e' FACOLTATIVA qui apposta: quando il
        chiamante non la conosce ancora (es. la tabella collegata non
        esiste ancora), la conferma resta comunque tracciata come
        "confermata, nessuna azione collegata" -- va agganciata dopo, non
        va inventata un'azione al posto suo. Costruito il 22/08/2026 per
        Sabrina, ma non menziona Sabrina in nessun punto: qualunque agente
        futuro puo' chiamarlo.

        BUG REALE trovato e corretto il 22/08/2026: questo metodo usava
        record.message_post() senza partner_ids -- scrive nel chatter (si
        vede aprendo il record) ma non genera NESSUNA notifica/voce inbox
        reale per nessuno, a meno che il destinatario non fosse gia'
        follower del record (quasi mai vero per una voce erpv6.kb
        changelog_tecnico appena creata). Verificato dal vivo con una query
        su mail_notification: zero righe per tutti i messaggi storici degli
        agenti. Corretto usando record.message_notify(partner_ids=...)
        (stesso pattern gia' corretto altrove -- vedi agent_proposal.py
        _do_accept, email_from esplicito compreso) -- genera una vera
        notifica per notify_partner_ids (default: l'admin/Denis, se non
        specificato) oltre a restare visibile nel chatter."""
        self.ensure_one()
        facts_text = "\n".join("- %s" % f for f in facts) if facts else _("(nessun dettaglio fornito)")
        body = self._compose_notice_text(title, facts_text)
        record = self.env[res_model].browse(res_id)
        if not record.exists():
            raise ValueError("notify_pending_confirmation: record %s#%s non esiste." % (res_model, res_id))
        author_id = self.partner_id.id if self.partner_id else self.env.user.partner_id.id
        if notify_partner_ids is None:
            notify_partner_ids = self._default_notify_partner_ids()
        message = self._notify_or_post(
            record, notify_partner_ids, title, body.replace("\n", "<br/>"), author_id)
        # Creata QUI (prima del blocco Telegram sotto, non piu' alla fine
        # del metodo, 24/08/2026): il bottone Telegram deve incorporare
        # l'id reale della conferma nel callback_data, vedi
        # erpv6.agent.confirmation._telegram_reply_markup.
        confirmation = self.env['erpv6.agent.confirmation'].create({
            'agent_config_id': self.id,
            'name': title,
            'res_model': res_model,
            'res_id': res_id,
            'notice_message_id': message.id,
            'action_model': action_model or False,
            'action_res_id': action_res_id or False,
            'action_method': action_method or False,
            'state': 'pending',
        })
        # Instradamento per presenza (24/08/2026, richiesto esplicitamente
        # da Denis: "se sono collegato manda la chat, se non rispondo manda
        # Telegram, se non sono collegato manda direttamente Telegram" -
        # dopo che la proposta #18 e' rimasta invisibile perche' nessun
        # canale l'aveva mai spinta attivamente). Qui si copre SOLO il
        # terzo caso (non connesso -> Telegram subito): il secondo caso
        # (connesso ma non risponde -> Telegram dopo un'attesa) e' gia'
        # gestito da erpv6.agent.confirmation._cron_check_escalations,
        # escalation_minutes dopo. im_status e' il campo nativo di Odoo
        # (bus.presence), non un dato inventato qui. Bottoni cliccabili
        # (24/08/2026, richiesto esplicitamente: "anche loro devono avere
        # accetta rifiuta") -- stesso meccanismo gia' in uso per le proposte.
        for partner in self.env['res.partner'].browse(notify_partner_ids):
            user = partner.user_ids[:1]
            if user and user.im_status != 'online':
                try:
                    self.env['erpv6.agent.telegram.config'].send_message_for_agent(
                        self, body, reply_markup=confirmation._telegram_reply_markup())
                except Exception:
                    _logger.exception(
                        "Invio Telegram immediato (utente non online) fallito per %s -- il "
                        "canale Discuss/email sopra resta comunque valido.", self.code)
        return confirmation

    # ------------------------------------------------------------------
    # Canale Discuss SEMPRE presente (Compito 2, 23/08/2026): "non
    # cercabile/da scoprire -- deve trovarli gia' nella sidebar". Verificato
    # dal vivo il 23/08/2026 che NON serve un res.users per l'agente: si usa
    # lo stesso metodo nativo che Odoo usa per "Nuovo Messaggio"
    # (discuss.channel.channel_get), chiamato con with_user(l'utente umano
    # di destinazione) cosi' il canale viene pinnato per LUI -- l'agente
    # resta un semplice res.partner, la controparte del canale, esattamente
    # come gia' succede oggi per notify_pending_confirmation/i canali
    # diretti (_check_direct_messages). Nessuna soluzione fragile (nessun
    # utente "interno" fittizio necessario): questa e' l'API nativa di
    # Odoo Discuss, non un workaround.
    # ------------------------------------------------------------------

    def _ensure_discuss_channel(self, target_user=None):
        """Crea (o trova, canonico -- channel_get e' idempotente) il canale
        Discuss diretto tra questo agente e target_user (default: l'admin,
        unico utente umano reale del sistema oggi -- vedi
        _default_notify_partner_ids per lo stesso principio). Pinnato per
        target_user, cosi' compare SUBITO nella sua sidebar senza dover
        cercare/avviare lui la conversazione."""
        self.ensure_one()
        if not self.partner_id:
            _logger.warning(
                "Agente %s senza partner_id -- impossibile creare un canale Discuss (nessuna identita' "
                "da cui scrivere).", self.code)
            return False
        if target_user is None:
            target_user = self.env.ref('base.user_admin', raise_if_not_found=False)
        if not target_user:
            _logger.warning("Nessun utente admin trovato -- impossibile creare il canale Discuss per %s.", self.code)
            return False
        channel = self.env['discuss.channel'].with_user(target_user).channel_get(
            [self.partner_id.id], pin=True)
        is_new = self.discuss_channel_id.id != channel.id
        self.discuss_channel_id = channel.id
        if is_new:
            # Un primo messaggio in voce propria (non un post di sistema):
            # oltre a dare subito contesto a Denis, fa si' che il canale
            # abbia last_interest_dt/un messaggio reale, non resti vuoto.
            channel.sudo().message_post(
                body=_(
                    "Ciao, sono %s. Questo è il mio canale diretto — scrivimi qui quando vuoi, oppure "
                    "troverai i miei avvisi anche sui thread dei record a cui si riferiscono."
                ) % self.name,
                author_id=self.partner_id.id, message_type='comment', subtype_xmlid='mail.mt_comment',
            )
        return channel

    @api.model
    def _cron_ensure_agent_discuss_channels(self):
        """Cron condiviso (stesso principio degli altri cron generici di
        questo file): garantisce che OGNI agente attivo con un'identita'
        (partner_id) abbia un canale Discuss diretto con l'admin -- un
        nuovo agente futuro (creato da Thor) viene coperto automaticamente,
        senza aggiungere nessun cron XML dedicato. Idempotente: se il
        canale esiste gia' (discuss_channel_id valorizzato), non lo ricrea
        ne' posta un nuovo messaggio di benvenuto."""
        agents = self.search([
            ('active', '=', True), ('partner_id', '!=', False), ('discuss_channel_id', '=', False),
        ])
        for agent in agents:
            try:
                agent._ensure_discuss_channel()
            except Exception:
                _logger.exception(
                    "Creazione canale Discuss fallita per l'agente %s -- riprovera' al prossimo giro.",
                    agent.code)

    @api.model
    def _cron_run_generic_agents(self):
        """Esegue TUTTI gli agenti configurati per il pattern generico
        'text_proposal' con context_category_id valorizzato -- un solo
        cron condiviso, non uno per agente: un nuovo agente creato da Thor
        viene eseguito automaticamente appena configurato, senza toccare
        nessun file XML di cron."""
        configs = self.search([
            ('active', '=', True),
            ('pattern_id.code', '=', 'text_proposal'),
            ('context_category_id', '!=', False),
        ])
        for config in configs:
            config._run_generic_text_proposal()

    def _run_generic_text_proposal(self):
        """Motore generico del pattern 'text_proposal': legge istruzioni +
        contesto da due categorie KB, chiama l'AI, salva SEMPRE in attesa
        di gate umano (erpv6.agent.proposal) -- mai auto-applicato. Genera
        al massimo UNA proposta per giro, mai una per singola voce KB di
        contesto (stesso principio gia' seguito per il certificato
        consolidato e per l'agente Kaizen: niente spam)."""
        self.ensure_one()
        # is_active=True esplicito su entrambe le ricerche: senza, una voce
        # KB disattivata (es. una regola ritirata) resterebbe comunque letta
        # e applicata dall'agente -- bug reale trovato da un agente di
        # verifica dedicato il 20/08/2026, non solo teorico.
        instructions_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', self.instructions_category_id.id), ('is_active', '=', True)], order='name')
        if not instructions_kbs:
            _logger.warning("Agente %s: nessuna voce KB di istruzioni, nessuna proposta generata.", self.code)
            return
        context_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', self.context_category_id.id), ('is_active', '=', True)], order='name')
        if not context_kbs:
            _logger.info("Agente %s: nessuna voce KB di contesto, nessuna proposta da generare.", self.code)
            return
        instructions_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in instructions_kbs)
        context_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in context_kbs)
        persona_text = self._get_persona_text()
        memory_kbs = self._get_memory_kbs()
        memory_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in memory_kbs)

        system_prompt = (
            "Sei l'agente '%(name)s' del sistema erpv6.%(persona)s Applichi le istruzioni sotto per "
            "proporre UNA sola azione concreta basata sui fatti/contesto fornito -- non inventare "
            "nulla che non sia nei fatti, non proporre nulla se i fatti non giustificano un'azione "
            "chiara. Non applichi mai nulla da solo: la tua proposta va sempre a un umano per la "
            "revisione. Rispondi SOLO con un oggetto JSON valido, senza markdown code fence, senza "
            "altro testo: "
            '{"title": "<titolo breve>", "proposal_text": "<proposta in italiano, concreta e '
            'azionabile>", "rule_applied": "<quale istruzione hai applicato>"}\n\n'
            "ISTRUZIONI:\n%(instructions)s%(memory)s"
        ) % {
            'name': self.name,
            'persona': (" " + persona_text) if persona_text else '',
            'instructions': instructions_text,
            'memory': ("\n\nMEMORIA DELLE TUE PROPOSTE PRECEDENTI (piu' recenti prima, usale per non "
                       "ripeterti e per essere coerente col tuo storico):\n%s" % memory_text) if memory_text else '',
        }

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type=self.omni_task_type,
            payload={
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': _("CONTESTO/FATTI ATTUALI:\n%s") % context_text},
                ],
            },
            context={'source': 'erpv6_agent:_run_generic_text_proposal', 'agent_code': self.code},
        )
        if not result.get('success'):
            _logger.warning("Agente %s: chiamata AI fallita, nessuna proposta generata: %s", self.code, result.get('error'))
            return
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning("Agente %s: risposta AI in formato inatteso, nessuna proposta generata: %s", self.code, e)
            return
        if not parsed.get('title') or not parsed.get('proposal_text'):
            _logger.warning("Agente %s: risposta AI incompleta, scartata.", self.code)
            return

        self.env['erpv6.agent.proposal'].create({
            'agent_config_id': self.id,
            'name': parsed['title'],
            'proposal_text': parsed['proposal_text'],
            'based_on': context_text,
            'rule_applied': parsed.get('rule_applied', ''),
            'provider_name': result.get('provider_used', ''),
        })
        self._write_memory(_("Ho proposto: %(title)s — %(text)s") % {
            'title': parsed['title'], 'text': parsed['proposal_text']})
