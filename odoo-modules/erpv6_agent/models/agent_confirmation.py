import logging
from datetime import timedelta

from odoo import _, api, fields, models
from odoo.tools import html2plaintext

_logger = logging.getLogger(__name__)

# Lista CHIUSA di parole chiave di conferma -- deliberatamente non
# configurabile da interfaccia (non un campo Char libero su nessun record):
# aggiunta il 22/08/2026 su richiesta esplicita dell'utente ("mai
# un'interpretazione libera del testo, solo parole chiave chiuse esplicite
# legate a una proposta specifica gia' mostrata"). Cambiarla e' una
# decisione di sicurezza, va fatta qui nel codice, mai lasciata a un
# amministratore da un campo di configurazione.
AGENT_CONFIRM_KEYWORDS = {'ok', 'approvo', 'si', "si'", 'sì', 'confermo', 'confermato'}

# Vocabolario CHIUSO separato per le decisioni di avanzamento fase (Compito
# 5, 23/08/2026: "pattern di conferma per avanzamento di fase"). Deliberatamente
# NON lo stesso insieme di AGENT_CONFIRM_KEYWORDS sopra -- una decisione di
# fase ha 3 esiti possibili (non solo si/no), quindi serve un vocabolario suo,
# dettato esplicitamente da Denis: {ok, procedi, pianifica, fermati, stop}.
# 'ok' e 'procedi' sono sinonimi dello stesso esito ('procedi'); 'fermati' e
# 'stop' sono sinonimi dello stesso esito ('fermati'). Come per
# AGENT_CONFIRM_KEYWORDS, mai configurabile da interfaccia: e' una decisione
# di sicurezza/comportamento, vive solo qui nel codice.
PHASE_DECISION_KEYWORDS = {
    'ok': 'procedi', 'procedi': 'procedi',
    'pianifica': 'pianifica',
    'fermati': 'fermati', 'stop': 'fermati',
}


class Erpv6AgentConfirmation(models.Model):
    """Traccia UN avviso specifico scritto da un agente (vedi
    erpv6.agent.config.notify_pending_confirmation) in attesa che un umano
    risponda con una parola chiave chiusa (AGENT_CONFIRM_KEYWORDS) nello
    STESSO thread (stesso res_model/res_id, messaggio successivo a
    notice_message_id) -- mai un'azione dedotta liberamente dal testo.

    Generico per costruzione: nato per Sabrina/vocabolario KG (22/08/2026)
    ma non menziona ne' Sabrina ne' il Knowledge Graph in nessun campo --
    qualunque agente futuro con qualunque azione predefinita puo' usare lo
    stesso meccanismo, aprendo una riga qui con action_model/action_res_id/
    action_method diversi.

    action_model/action_res_id/action_method possono restare vuoti quando
    il chiamante non conosce ancora l'azione da collegare (es. la tabella
    di destinazione non esiste ancora): la conferma viene comunque
    registrata, con stato 'confirmed_no_action' -- PLACEHOLDER esplicito,
    da agganciare in un secondo momento, mai un'azione indovinata al posto
    di quella mancante.

    Dal 22/08/2026: un messaggio umano nello stesso thread che NON e' una
    parola chiave (last_seen_message_id traccia fin dove il cron ha gia'
    esaminato) genera comunque una risposta VERA -- conversazionale, mai
    un'azione -- via erpv6.agent.config.answer_conversationally. Anche
    questo e' generico: nessun agente specifico menzionato qui."""
    _name = 'erpv6.agent.confirmation'
    _description = 'Conferma in Attesa su Avviso di un Agente'
    _order = 'create_date desc'

    # ondelete='cascade': stessa regola gia' seguita per erpv6.agent.proposal
    # ("cancello l'agente si cancella tutto", richiesta esplicita
    # dell'utente il 20/08/2026).
    agent_config_id = fields.Many2one('erpv6.agent.config', string='Agente', required=True, index=True, ondelete='cascade')
    name = fields.Char(string='Titolo Avviso', required=True)

    res_model = fields.Char(string='Modello Thread', required=True,
                             help="Modello del record sul cui chatter e' stato scritto l'avviso (deve supportare mail.thread).")
    res_id = fields.Integer(string='ID Record Thread', required=True)
    notice_message_id = fields.Many2one(
        'mail.message', string='Messaggio Avviso', ondelete='set null',
        help="Il messaggio che l'agente ha scritto nel thread -- il cron cerca SOLO messaggi "
             "successivi a questo, sullo stesso record, per evitare falsi positivi su risposte "
             "precedenti non collegate a questo avviso.")

    action_model = fields.Char(string='Modello Azione', help="Modello su cui eseguire l'azione predefinita alla conferma. Vuoto = nessuna azione ancora agganciata.")
    action_res_id = fields.Integer(string='ID Record Azione')
    action_method = fields.Char(string='Metodo Azione', help="Nome di un metodo senza argomenti da chiamare sul record azione (es. 'action_activate').")

    decision_type = fields.Selection([
        ('confirm', 'Conferma singola azione (si/no)'),
        ('phase_decision', 'Decisione di fase (procedi/pianifica/fermati)'),
    ], string='Tipo Decisione', default='confirm', required=True,
        help="'confirm' (default, invariato): match esatto su AGENT_CONFIRM_KEYWORDS, un solo esito "
             "(confermato/non confermato). 'phase_decision' (Compito 5, 23/08/2026): match su "
             "PHASE_DECISION_KEYWORDS, tre esiti possibili -- usato da erpv6.production.order quando "
             "una fase (soprattutto di estrazione/popolamento conoscenza) e' pronta per avanzare, "
             "vedi request_phase_decision() sotto.")
    decision_result = fields.Selection([
        ('procedi', 'Procedi'), ('pianifica', 'Pianifica'), ('fermati', 'Fermati'),
    ], string='Decisione Presa', readonly=True, copy=False,
        help="Valorizzato solo per decision_type='phase_decision', all'esito della decisione umana. "
             "Vuoto per decision_type='confirm' (li' basta lo stato).")

    state = fields.Selection([
        ('pending', 'In attesa di conferma'),
        ('confirmed', 'Confermata — azione eseguita'),
        ('confirmed_no_action', 'Confermata — nessuna azione collegata'),
        ('action_error', 'Confermata — azione fallita'),
    ], string='Stato', default='pending', required=True, index=True)

    confirmed_by = fields.Many2one('res.users', string='Confermata da')
    confirmed_at = fields.Datetime(string='Confermata il')
    confirmed_message_id = fields.Many2one('mail.message', string='Messaggio di Conferma', ondelete='set null')
    confirmation_notes = fields.Text(string='Note')
    last_seen_message_id = fields.Many2one(
        'mail.message', string='Ultimo Messaggio Esaminato', ondelete='set null',
        help="Aggiunto il 22/08/2026 per il dialogo bidirezionale (vedi _reply_conversationally): "
             "segna fino a dove il cron ha gia' esaminato i messaggi umani di questo thread, cosi' "
             "un messaggio che non era una parola chiave di conferma (e quindi ha gia' ricevuto una "
             "risposta conversazionale) non viene rivalutato/riproposto ad ogni giro successivo. "
             "Vuoto = non ancora esaminato nulla dopo notice_message_id.")
    escalated_at = fields.Datetime(
        string='Promemoria Susanna Inviato Il', copy=False,
        help="Aggiunto il 22/08/2026 per l'agente 'Susanna' (coordinatore, mai esegue azioni "
             "reali): valorizzato la PRIMA volta che _cron_check_escalations trova questa "
             "conferma ancora 'pending' da oltre erpv6.agent.config(susanna).escalation_minutes "
             "minuti e fa scrivere a Susanna un promemoria nello STESSO thread (vedi _escalate). Un solo "
             "promemoria per conferma (non ripetuto ad ogni giro) -- se serve un secondo sollecito "
             "e' una decisione da rivedere esplicitamente, non il comportamento di default. Vuoto "
             "= nessun promemoria ancora inviato per questa conferma.")

    def _check_for_confirmation(self):
        """Cerca, sullo stesso thread (res_model/res_id) e DOPO
        l'ultimo messaggio gia' esaminato (last_seen_message_id, o
        notice_message_id se e' il primo giro), ogni messaggio NUOVO
        scritto da un umano reale (non un bot, non uno degli agenti
        stessi). Se il testo -- ripulito da HTML e normalizzato --
        corrisponde ESATTAMENTE a una delle AGENT_CONFIRM_KEYWORDS (match
        sull'intero messaggio, non una sottostringa: "ok ma prima verifica
        X" NON conta come conferma, deliberatamente), esegue l'azione
        predefinita come prima -- QUESTO resta l'unico modo per far partire
        un'azione, invariato dal 22/08/2026.

        Dal 22/08/2026 (richiesta esplicita: "voglio poter dialogare con
        kaizen, come con sabrina"), un messaggio umano che NON e' la parola
        chiave non viene piu' ignorato in silenzio: e' trattato come una
        domanda/commento genuino, l'agente genera e posta una risposta
        conversazionale VERA nello stesso thread (erpv6.agent.config.
        answer_conversationally) -- SOLO testo, mai un'azione dedotta dal
        linguaggio naturale (quella resta gated esclusivamente dalla parola
        chiave chiusa, invariata sopra)."""
        self.ensure_one()
        if self.state != 'pending' or not self.notice_message_id:
            return
        Message = self.env['mail.message']
        agent_partner_ids = self.env['erpv6.agent.config'].sudo().search([]).mapped('partner_id').ids
        after_id = self.last_seen_message_id.id if self.last_seen_message_id else self.notice_message_id.id
        candidates = Message.sudo().search([
            ('id', '>', after_id),
            ('model', '=', self.res_model),
            ('res_id', '=', self.res_id),
            ('message_type', '=', 'comment'),
        ], order='id asc')
        if not candidates:
            return
        for msg in candidates:
            if not msg.author_id or not msg.author_id.user_ids:
                continue  # niente autore o autore senza utente reale (es. bot/import) -> ignorato
            if msg.author_id.id in agent_partner_ids:
                continue  # messaggio scritto da un agente (anche un altro) -> mai auto-conferma
            text = html2plaintext(msg.body or '').strip().strip('.! ').lower().replace("’", "'")
            if self.decision_type == 'phase_decision':
                decision = PHASE_DECISION_KEYWORDS.get(text)
                if decision:
                    self._do_phase_decision(msg.author_id.user_ids[:1], decision, message=msg)
                    return
            elif text in AGENT_CONFIRM_KEYWORDS:
                self._do_confirm(msg.author_id.user_ids[:1], message=msg)
                return
            self._reply_conversationally(msg)
        # Nessuna parola chiave trovata in questo giro: tutti i candidati
        # sono stati esaminati (risposto o scartato) -- avanza il marcatore
        # cosi' il prossimo giro del cron non li rivaluta da capo.
        self.last_seen_message_id = candidates[-1].id

    def _compose_thread_history(self, up_to_message):
        """Ricostruisce il testo dello scambio (dal messaggio di avviso
        fino a up_to_message incluso), un umano legge tutto il thread per
        rispondere con contesto -- l'AI deve poter fare lo stesso, non solo
        vedere l'ultimo messaggio isolato."""
        self.ensure_one()
        Message = self.env['mail.message']
        agent_partners = self.env['erpv6.agent.config'].sudo().search([]).mapped('partner_id')
        agent_names_by_partner = {p.id: p.name for p in agent_partners}
        messages = Message.sudo().search([
            ('id', '>=', self.notice_message_id.id),
            ('id', '<=', up_to_message.id),
            ('model', '=', self.res_model),
            ('res_id', '=', self.res_id),
            ('message_type', '=', 'comment'),
        ], order='id asc')
        lines = []
        for m in messages:
            author_name = agent_names_by_partner.get(m.author_id.id) or (m.author_id.name if m.author_id else '?')
            lines.append("%s: %s" % (author_name, html2plaintext(m.body or '').strip()))
        return "\n".join(lines)

    def _reply_conversationally(self, msg):
        """Genera e posta la risposta conversazionale dell'agente al
        messaggio umano msg -- SOLO testo (vedi
        erpv6.agent.config.answer_conversationally per il vincolo
        anti-azione). Un messaggio vuoto dopo la pulizia HTML (es. solo
        un'emoji o un allegato senza testo) non genera nessuna chiamata AI
        sprecata."""
        self.ensure_one()
        question_text = html2plaintext(msg.body or '').strip()
        if not question_text:
            return
        record = self.env[self.res_model].browse(self.res_id)
        if not record.exists() or not hasattr(record, 'message_post'):
            return
        thread_history = self._compose_thread_history(msg)
        answer, pending_action = self.agent_config_id.answer_conversationally(
            title=self.name, thread_history=thread_history, question_text=question_text)
        if pending_action:
            # Il bottone/comando 'registra' vive solo su Telegram (vedi
            # agent_telegram_config.py) - su Discuss non c'e' ancora un
            # meccanismo equivalente, quindi si dice la verita' invece di
            # far finta che basti rispondere qui.
            answer += _(
                "\n\n(Per registrarla per davvero, scrivimi su Telegram \"registra\" — "
                "qui su Discuss non è ancora collegato.)"
            )
        author_id = self.agent_config_id.partner_id.id if self.agent_config_id.partner_id else self.env.user.partner_id.id
        # _notify_or_post (message_notify sotto, stesso fix del 22/08/2026 di
        # notify_pending_confirmation): una risposta conversazionale che
        # finisce solo nel chatter, invisibile, vanificherebbe l'intero
        # punto del dialogo bidirezionale richiesto.
        AgentConfig = self.env['erpv6.agent.config']
        AgentConfig._notify_or_post(
            record, AgentConfig._default_notify_partner_ids(),
            _("Re: %s") % self.name, answer.replace("\n", "<br/>"), author_id)

    def _do_confirm(self, user, message=None):
        """Esegue l'azione predefinita se agganciata, altrimenti registra
        la conferma con stato 'confirmed_no_action' (placeholder esplicito
        -- vedi docstring della classe). Un errore nell'azione non viene
        mai inghiottito in silenzio: stato 'action_error' + log + nota nel
        thread, cosi' un umano lo vede.

        user/message separati (24/08/2026, per i bottoni Telegram su
        erpv6.agent.confirmation): un click Telegram non ha un mail.message
        Discuss dietro, ma DEVE comunque tracciare chi ha confermato --
        message resta opzionale (solo il canale Discuss lo valorizza).
        Ritorna ack_text: il chiamante Telegram lo rimanda come conferma
        del bottone, il chiamante Discuss lo posta gia' da solo sotto."""
        self.ensure_one()
        vals = {
            'state': 'confirmed',
            'confirmed_by': user.id if user else False,
            'confirmed_at': fields.Datetime.now(),
        }
        if message:
            vals['confirmed_message_id'] = message.id
        ack_text = None
        if self.action_model and self.action_res_id and self.action_method:
            try:
                target = self.env[self.action_model].browse(self.action_res_id)
                if not target.exists():
                    raise ValueError(_("Record %(model)s#%(id)s non esiste piu'.") % {
                        'model': self.action_model, 'id': self.action_res_id})
                getattr(target, self.action_method)()
                ack_text = _("Confermato — azione eseguita (%(model)s.%(method)s su #%(id)s).") % {
                    'model': self.action_model, 'method': self.action_method, 'id': self.action_res_id}
            except Exception as e:
                _logger.error(
                    "erpv6.agent.confirmation #%s: azione %s.%s su #%s fallita: %s",
                    self.id, self.action_model, self.action_method, self.action_res_id, e)
                vals['state'] = 'action_error'
                vals['confirmation_notes'] = _("Azione fallita: %s") % e
                ack_text = _("Confermato, ma l'azione collegata e' fallita: %s") % e
        else:
            vals['state'] = 'confirmed_no_action'
            vals['confirmation_notes'] = _(
                "Nessuna azione collegata ancora (placeholder) -- confermato, ma va agganciato "
                "manualmente quando l'azione reale sara' disponibile.")
            ack_text = _("Confermato — nessuna azione automatica ancora collegata, resta da fare a mano per ora.")
        self.write(vals)
        record = self.env[self.res_model].browse(self.res_id)
        if record.exists() and hasattr(record, 'message_post'):
            author_id = self.agent_config_id.partner_id.id if self.agent_config_id.partner_id else self.env.user.partner_id.id
            # _notify_or_post (message_notify sotto): stesso bug 'notifica
            # invisibile' del 22/08/2026 gia' corretto in
            # notify_pending_confirmation -- senza partner_ids espliciti,
            # questo messaggio finirebbe solo nel chatter, mai nell'inbox
            # reale di chi ha appena confermato.
            AgentConfig = self.env['erpv6.agent.config']
            AgentConfig._notify_or_post(
                record, AgentConfig._default_notify_partner_ids(),
                _("Confermato: %s") % self.name, ack_text, author_id)
        return ack_text

    def _do_phase_decision(self, user, decision, message=None):
        """Esegue l'esito di una decisione di fase (Compito 5, 23/08/2026) --
        parallelo di _do_confirm ma con TRE esiti invece di uno solo:
        - 'procedi': chiama l'azione predefinita (action_model/action_res_id/
          action_method), esattamente come _do_confirm -- e' il chiamante
          (erpv6.production.order._open_phase_gate) ad agganciare qui il
          metodo che fa avanzare davvero la fase.
        - 'pianifica': NON esegue nessuna azione ora -- registra la
          decisione e lascia al chiamante il compito di ripianificare (una
          nuova attivita'/task, vedi request_phase_decision), la fase resta
          ferma finche' non arriva un nuovo giro con 'procedi' o 'fermati'.
        - 'fermati': NON esegue nessuna azione -- la fase resta ferma
          esplicitamente, per scelta umana, non per un blocco tecnico."""
        self.ensure_one()
        vals = {
            'decision_result': decision,
            'confirmed_by': user.id if user else False,
            'confirmed_at': fields.Datetime.now(),
        }
        if message:
            vals['confirmed_message_id'] = message.id
        if decision == 'procedi':
            if self.action_model and self.action_res_id and self.action_method:
                try:
                    target = self.env[self.action_model].browse(self.action_res_id)
                    if not target.exists():
                        raise ValueError(_("Record %(model)s#%(id)s non esiste piu'.") % {
                            'model': self.action_model, 'id': self.action_res_id})
                    getattr(target, self.action_method)()
                    vals['state'] = 'confirmed'
                    ack_text = _("Procedi — fase avanzata (%(model)s.%(method)s su #%(id)s).") % {
                        'model': self.action_model, 'method': self.action_method, 'id': self.action_res_id}
                except Exception as e:
                    _logger.error(
                        "erpv6.agent.confirmation #%s (phase_decision): azione %s.%s su #%s fallita: %s",
                        self.id, self.action_model, self.action_method, self.action_res_id, e)
                    vals['state'] = 'action_error'
                    vals['confirmation_notes'] = _("Azione fallita: %s") % e
                    ack_text = _("Procedi, ma l'avanzamento e' fallito: %s") % e
            else:
                vals['state'] = 'confirmed_no_action'
                ack_text = _("Procedi registrato, ma nessuna azione di avanzamento agganciata (placeholder).")
        elif decision == 'pianifica':
            vals['state'] = 'confirmed_no_action'
            vals['confirmation_notes'] = _("Pianifica: nessun avanzamento ora, da rivalutare più avanti.")
            ack_text = _("Pianifica — fase non avanzata ora, resta segnata per una rivalutazione futura.")
        else:  # 'fermati'
            vals['state'] = 'confirmed_no_action'
            vals['confirmation_notes'] = _("Fermati: avanzamento bloccato esplicitamente per scelta umana.")
            ack_text = _("Fermati — fase non avanzata, bloccata esplicitamente. Nessun ritentativo automatico.")
        self.write(vals)
        record = self.env[self.res_model].browse(self.res_id)
        if record.exists() and hasattr(record, 'message_post'):
            author_id = self.agent_config_id.partner_id.id if self.agent_config_id.partner_id else self.env.user.partner_id.id
            AgentConfig = self.env['erpv6.agent.config']
            AgentConfig._notify_or_post(
                record, AgentConfig._default_notify_partner_ids(),
                _("%(decision)s: %(title)s") % {'decision': decision.capitalize(), 'title': self.name},
                ack_text, author_id)
        # Hook per il chiamante (es. erpv6.production.order): un metodo
        # generico non puo' sapere quali campi propri del chiamante pulire
        # (es. phase_gate_confirmation_id) -- se il record target espone
        # _on_phase_decision(decision), viene chiamato qui, sempre, anche per
        # 'pianifica'/'fermati' (che non hanno un action_method da eseguire).
        if record.exists() and hasattr(record, '_on_phase_decision'):
            try:
                record._on_phase_decision(decision, self)
            except Exception:
                _logger.exception(
                    "_on_phase_decision fallito per %s#%s dopo la decisione '%s' (conferma #%s) -- "
                    "la decisione resta comunque registrata sopra.", self.res_model, self.res_id, decision, self.id)
        return ack_text

    def _telegram_reply_markup(self):
        """Bottoni Telegram per QUESTA conferma (24/08/2026, richiesto
        esplicitamente da Denis: "anche loro devono avere accetta rifiuta"
        -- Sabrina/Andrea/Susanna oggi ne erano prive, a differenza delle
        proposte). decision_type determina il set: un solo esito per
        'confirm', tre per 'phase_decision' -- stesso vocabolario chiuso di
        PHASE_DECISION_KEYWORDS sopra, mai testo libero."""
        self.ensure_one()
        if self.decision_type == 'phase_decision':
            return {
                'inline_keyboard': [[
                    {'text': '▶️ Procedi', 'callback_data': 'procedi:%d' % self.id},
                    {'text': '📅 Pianifica', 'callback_data': 'pianifica:%d' % self.id},
                    {'text': '⏹️ Fermati', 'callback_data': 'fermati:%d' % self.id},
                ]],
            }
        return {
            'inline_keyboard': [[
                {'text': '✅ Confermo', 'callback_data': 'conferma:%d' % self.id},
            ]],
        }

    @api.model
    def request_phase_decision(self, agent_config, title, facts, res_model, res_id,
                                action_model=None, action_res_id=None, action_method=None,
                                notify_partner_ids=None):
        """Punto di ingresso GENERICO e riusabile per il pattern "procedi/
        pianifica/fermati" (Compito 5, 23/08/2026) -- costruito qui (non
        dentro erpv6_production) apposta cosi' qualunque processo di
        produzione (non solo erpv6.production.order) possa aprire lo stesso
        gate, con lo stesso vocabolario chiuso, senza duplicare logica.

        Esempio di un SECONDO chiamante che dovrebbe usare questo stesso
        metodo (non ancora collegato, fuori perimetro di stasera -- vedi
        report finale): erpv6_production/models/library_document.py,
        action_confirm_create_new_template() / _ensure_template_transformation_project()
        -- oggi quel flusso documento->template e' un'unica azione monolitica
        senza fasi esplicite. Lo stesso pattern andrebbe applicato li':
        fasi nominate (estrazione contenuto -> generazione bozza AI ->
        verifica compilazione -> generazione intervista -> revisione umana
        -> promozione a sorgente reale), ciascuna un project.task dentro lo
        STESSO project.project gia' creato da
        _ensure_template_transformation_project, con QUESTO metodo chiamato
        una volta per fase (non per singolo step interno) prima di avanzare
        alla fase successiva.

        facts DEVE gia' includere, dal chiamante, la spiegazione del
        vocabolario chiuso da usare (questo metodo non la inventa/aggiunge
        da solo -- resta responsabilita' del chiamante, che conosce il
        contesto specifico)."""
        confirmation = agent_config.notify_pending_confirmation(
            title=title, facts=facts, res_model=res_model, res_id=res_id,
            action_model=action_model, action_res_id=action_res_id, action_method=action_method,
            notify_partner_ids=notify_partner_ids,
        )
        confirmation.decision_type = 'phase_decision'
        return confirmation

    @api.model
    def _cron_check_pending_confirmations(self):
        """Cron condiviso (stesso pattern di _cron_run_generic_agents in
        agent_config.py): scansiona TUTTE le conferme in attesa di
        qualunque agente, non una per agente -- un nuovo agente che usa
        notify_pending_confirmation viene coperto da solo, senza aggiungere
        nessun cron XML."""
        pending = self.search([('state', '=', 'pending')])
        for confirmation in pending:
            confirmation._check_for_confirmation()

    # ------------------------------------------------------------------
    # Escalation a 5 minuti (Susanna, Compito 3, 22/08/2026) -- cron
    # DEDICATO e SEPARATO da _cron_check_pending_confirmations sopra
    # (quello scansiona messaggi umani ogni 15 minuti, un lavoro gia' reale
    # e non economico da stringere; questo controlla solo lo scadere del
    # tempo, un conteggio molto piu' leggero, quindi puo' girare piu'
    # spesso senza aggiungere costo AI ad ogni giro -- vedi requisito
    # esplicito "non serve una chiamata AI ad ogni giro se non c'e' nulla
    # di scaduto": la query di ricerca sotto e' sempre gratuita, l'AI
    # (dentro _escalate, via _compose_notice_text) viene chiamata SOLO per
    # ogni conferma davvero scaduta trovata, mai altrimenti).
    # ------------------------------------------------------------------

    @api.model
    def _cron_check_escalations(self):
        """Trova le conferme 'pending' da oltre
        erpv6.agent.config(susanna).escalation_minutes minuti senza ancora
        un promemoria (escalated_at vuoto) e fa scrivere a Susanna un
        sollecito nello stesso thread di ciascuna -- MAI l'agente
        originale (Sabrina/Kaizen/Andrea), sempre Susanna: e' lei il
        coordinatore che sorveglia le conferme in sospeso di tutti,
        coerente con la sua persona ("non esegue mai azioni reali, ma
        segnala/sollecita"). Controllo di scadenza sempre gratuito (una
        sola query); l'unica chiamata AI per giro e' una per ciascuna
        conferma davvero scaduta trovata (via _escalate), mai una a
        vuoto.

        La soglia (corretta il 23/08/2026, audit 'motore vs conoscenza':
        prima era la costante Python AGENT_CONFIRMATION_ESCALATION_MINUTES)
        vive ora sul campo escalation_minutes del record Susanna stesso --
        se Susanna non e' trovata/attiva qui, si usa comunque il default
        del campo (5) solo per calcolare la query: _escalate() sotto fa la
        stessa verifica su Susanna per ogni conferma e non scrive nulla se
        manca, quindi nessun comportamento diverso da prima in quel caso."""
        susanna = self.env['erpv6.agent.config'].search([('code', '=', 'susanna'), ('active', '=', True)], limit=1)
        escalation_minutes = susanna.escalation_minutes if susanna else 5
        threshold = fields.Datetime.now() - timedelta(minutes=escalation_minutes)
        overdue = self.search([
            ('state', '=', 'pending'),
            ('escalated_at', '=', False),
            ('create_date', '<', threshold),
        ])
        if not overdue:
            return
        for confirmation in overdue:
            try:
                confirmation._escalate()
            except Exception:
                _logger.exception(
                    "Escalation Susanna fallita per erpv6.agent.confirmation #%s -- riprovera' al "
                    "prossimo giro (escalated_at resta vuoto).", confirmation.id)

    def _escalate(self):
        """Scrive il promemoria vero e proprio, in voce di Susanna (mai
        l'agente originale) -- riusa DAVVERO l'infrastruttura gia'
        generica di erpv6.agent.config, nessun meccanismo di dialogo
        nuovo: _compose_notice_text (stessa funzione che Sabrina/Kaizen
        usano per il loro primo avviso) per formulare il testo in tono
        proprio a partire da fatti forniti, _notify_or_post (stesso fix
        'notifica invisibile' del 22/08/2026) per renderlo una notifica
        reale, non solo un messaggio invisibile nel chatter. Se l'agente
        Susanna non esiste/e' disattivato, logga e non fa nulla -- MAI
        un fallback silenzioso che finge un promemoria mai scritto."""
        self.ensure_one()
        AgentConfig = self.env['erpv6.agent.config']
        susanna = AgentConfig.search([('code', '=', 'susanna'), ('active', '=', True)], limit=1)
        if not susanna:
            _logger.warning(
                "Agente Susanna non trovato/attivo -- nessun promemoria di escalation per la "
                "conferma #%s (agente originale: %s).", self.id, self.agent_config_id.code)
            return
        record = self.env[self.res_model].browse(self.res_id)
        if not record.exists() or not hasattr(record, 'message_post'):
            return
        minutes_pending = int((fields.Datetime.now() - self.create_date).total_seconds() // 60)
        facts = [
            _("Questo avviso è stato scritto da %(agent)s ed è in attesa di conferma da "
              "%(minutes)d minuti, oltre la soglia di %(threshold)d minuti.") % {
                'agent': self.agent_config_id.name, 'minutes': minutes_pending,
                'threshold': susanna.escalation_minutes},
            _("Titolo dell'avviso originale: %s") % self.name,
        ]
        body = susanna._compose_notice_text(
            _("Promemoria: conferma in attesa da più di %d minuti") % susanna.escalation_minutes,
            "\n".join("- %s" % f for f in facts),
        )
        AgentConfig._notify_or_post(
            record, AgentConfig._default_notify_partner_ids(),
            _("Promemoria (Susanna): %s") % self.name,
            body.replace("\n", "<br/>"), susanna.partner_id.id if susanna.partner_id else self.env.user.partner_id.id,
        )
        self.escalated_at = fields.Datetime.now()
        # Compito 6 (23/08/2026): tenta ANCHE Telegram, se una configurazione
        # attiva esiste per Susanna -- oggi sempre no-op (nessun bot token
        # reale ancora fornito, vedi erpv6.agent.telegram.config), ma il
        # canale Discuss/email sopra e' gia' andato a buon fine in ogni caso:
        # un fallimento qui non deve mai propagarsi.
        try:
            self.env['erpv6.agent.telegram.config'].send_message_for_agent(
                susanna, body, reply_markup=self._telegram_reply_markup())
        except Exception:
            _logger.exception(
                "Invio Telegram (best-effort) fallito per l'escalation #%s -- il promemoria Discuss/"
                "email sopra resta comunque valido.", self.id)
