import json
import logging
import re

import requests

from odoo import _, api, fields, models
from odoo.tools import html2plaintext

_logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = 'https://api.telegram.org/bot%s'
TELEGRAM_HTTP_TIMEOUT = 15

# Comando esplicito per approvare/rifiutare una erpv6.agent.proposal da
# Telegram (24/08/2026, richiesto da Denis dopo aver scoperto che oggi una
# risposta su Telegram non cambiava nulla: "se non approvo lui non deve
# continuare, solo se approvo lui continua"). Solo parola chiave esplicita +
# id, MAI interpretazione libera del testo -- stesso principio non
# negoziabile gia' seguito per Sabrina/Andrea/Susanna (nessuna azione
# dedotta da un messaggio ambiguo).
PROPOSAL_DECISION_RE = re.compile(r'^\s*(approva|rifiuta)\s+(\d+)\s*$', re.IGNORECASE)

# Stesso principio, per erpv6.agent.confirmation (24/08/2026, richiesto
# esplicitamente da Denis dopo aver scoperto che Sabrina/Andrea non avevano
# bottoni come le proposte: "anche loro devono avere accetta/rifiuta").
# Vocabolario chiuso separato da AGENT_CONFIRM_KEYWORDS/PHASE_DECISION_KEYWORDS
# (agent_confirmation.py) apposta: qui e' un comando esplicito con id, non
# una parola libera nel thread Discuss -- 'conferma' e' l'unico esito per
# decision_type='confirm', gli altri tre per 'phase_decision'.
CONFIRMATION_DECISION_RE = re.compile(r'^\s*(conferma|procedi|pianifica|fermati)\s+(\d+)\s*$', re.IGNORECASE)

# 'registra' (25/08/2026): trasforma DAVVERO in un record reale (proposta
# per Claudio/Alessandro, o segnalazione Kaizen) una 'azione_proposta' che
# un agente (Susanna, Sabrina, o qualunque altro - vedi
# erpv6.agent.config.answer_conversationally) ha SOLO proposto in una
# risposta conversazionale, mai eseguito da sola. Con id: click sul
# bottone Telegram (il caso normale, callback_data='registra:<chat_log_id>'
# - preciso, nessuna ambiguita' su quale proposta). Senza id: comando
# testuale digitato (fallback se non c'e' un bottone, es. su Discuss) -
# usa l'ultima azione proposta non consumata su quella conversazione,
# vedi erpv6.agent.chat.log.find_pending_action.
REGISTRA_RE = re.compile(r'^\s*registra(?:\s+(\d+))?\s*$', re.IGNORECASE)


class Erpv6AgentTelegramConfig(models.Model):
    """Predisposizione COMPLETA (Compito 6, 23/08/2026) -- non piu' un
    placeholder vuoto: il codice reale di invio (send_message, sendMessage
    via HTTP) e ricezione (_poll_updates, getUpdates via HTTP, cron
    dedicato _cron_poll_telegram_updates) esiste ed e' collegato, ma resta
    DORMIENTE finche' nessun record ha is_active=True + un bot_token reale
    -- e is_active resta SEMPRE False finche' Denis non fornisce un vero
    Bot Token (vedi note_placeholder), quindi oggi il cron gira ma non fa
    mai nulla (una query veloce, zero chiamate HTTP). Scelta POLLING (non
    webhook): niente nuovo endpoint pubblico da esporre su questo VPS
    (Caddy/reverse proxy andrebbero riconfigurati, superficie d'attacco in
    piu'), a costo di una latenza di risposta pari all'intervallo del cron
    (ir_cron_data.xml, ogni 2 minuti) -- accettabile per un canale di
    coordinamento con Denis, non per un bot ad alto traffico.

    Integrazione (Compito 3, routing Heinrich): il gate umano di
    escalation gia' esistente (erpv6.agent.confirmation._escalate, "grave"
    o promemoria Susanna scaduto) prova ANCHE a inviare via Telegram se
    esiste una config attiva per l'agente che sta scrivendo -- vedi
    send_message_for_agent() sotto, chiamata da agent_confirmation.py.
    Un fallimento qui non deve mai bloccare il canale Discuss/email gia'
    funzionante: try/except sempre lato chiamante.

    Modello dedicato (non un campo su erpv6.agent.config) perche' un canale
    Telegram e' una risorsa a se' (un bot puo' in teoria servire piu' agenti,
    o un agente potrebbe non averne mai bisogno) -- stessa scelta gia' fatta
    per erpv6.omni.provider rispetto a erpv6.agent.config.

    Cifratura: STESSO pattern di erpv6.omni.provider.api_key
    (odoo-modules/erpv6_omni_bridge/models/omni_provider.py) -- cifrato via
    erpv6.crypto.engine al salvataggio, mai in chiaro a riposo, decifrato
    solo lato server tramite get_decrypted_bot_token() (mai esposto al
    frontend)."""
    _name = 'erpv6.agent.telegram.config'
    _description = 'Configurazione Bot Telegram per Agente AI (placeholder, non attivo)'

    name = fields.Char(string='Nome Configurazione', required=True)
    agent_config_id = fields.Many2one(
        'erpv6.agent.config', string='Agente Collegato',
        help="Facoltativo: quale agente (es. Susanna) userebbe questo bot per scrivere/ricevere "
             "messaggi Telegram. Vuoto = configurazione non ancora assegnata a un agente specifico.")

    # 🔐 CAMPO CIFRATO: stesso trattamento di erpv6.omni.provider.api_key --
    # cifrato in create/write, mai leggibile in chiaro se non tramite
    # get_decrypted_bot_token().
    bot_token = fields.Char(
        string='Bot Token (Cifrato)',
        help="Token del bot Telegram (da @BotFather). VUOTO OGGI -- Denis non ha ancora fornito "
             "un vero Bot Token (22/08/2026). Cifrato automaticamente al salvataggio, stesso "
             "meccanismo di erpv6.omni.provider.api_key.")
    chat_id = fields.Char(
        string='Chat ID Destinatario',
        help="ID della chat Telegram (privata o di gruppo) a cui l'agente scriverebbe -- si ottiene "
             "solo dopo aver collegato un bot token reale e fatto interagire il bot almeno una "
             "volta. Vuoto finche' il bot token non e' reale.")
    last_update_id = fields.Integer(
        string='Ultimo Update ID Elaborato', default=0,
        help="Offset di polling (Compito 6, 23/08/2026): getUpdates ritorna solo gli aggiornamenti "
             "con update_id > questo valore (parametro 'offset' dell'API Telegram, che marca anche "
             "come 'confermati' gli update precedenti lato server Telegram). 0 = nessun polling "
             "ancora avvenuto.")

    is_active = fields.Boolean(
        string='Attivo', default=False,
        help="Resta SEMPRE False finche' bot_token non e' un token Telegram reale -- nessun "
             "codice in questo progetto legge/usa questo canale oggi (nessun webhook, nessun "
             "invio), quindi 'attivo' qui è solo un'intenzione futura, non un interruttore "
             "funzionante. Vedi note_placeholder sotto per il motivo.")
    note_placeholder = fields.Text(
        string='Nota',
        default=lambda self: _(
            "PLACEHOLDER creato il 22/08/2026 (Compito 3, agente Susanna). Nessun canale Telegram "
            "reale è collegato: Denis non ha ancora fornito un vero Bot Token. Questa struttura "
            "esiste solo per non dover riprogettare lo storage cifrato quando la chiave arriverà "
            "-- nessun cron, nessun webhook, nessun invio/ricezione messaggi è cablato da nessuna "
            "parte del codice oggi. Per attivare davvero: (1) ottenere un Bot Token reale da "
            "@BotFather, (2) valorizzare bot_token qui (verrà cifrato automaticamente), (3) "
            "scrivere il codice di invio/ricezione (non ancora fatto, fuori perimetro di questo "
            "compito), (4) solo allora impostare is_active=True."),
        readonly=True,
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('bot_token'):
                vals['bot_token'] = self._encrypt_token(vals['bot_token'])
        return super().create(vals_list)

    def write(self, vals):
        if vals.get('bot_token'):
            vals['bot_token'] = self._encrypt_token(vals['bot_token'])
        return super().write(vals)

    def _encrypt_token(self, token):
        """Stesso schema di erpv6.omni.provider._encrypt_key: se e' gia' un
        payload JSON (gia' cifrato), lo lascia com'e' -- evita una doppia
        cifratura su un write che non tocca davvero il token in chiaro."""
        try:
            json.loads(token)
            return token
        except (json.JSONDecodeError, TypeError):
            return self.env['erpv6.crypto.engine'].encrypt(token)

    def get_decrypted_bot_token(self):
        """Stesso schema di erpv6.omni.provider.get_decrypted_api_key --
        SOLO uso lato server, mai esposto al frontend. Nessun chiamante
        reale esiste ancora nel codebase (vedi docstring della classe):
        presente solo cosi' che il futuro codice di invio Telegram non
        debba reinventare la decifratura."""
        self.ensure_one()
        if not self.bot_token:
            return ''
        try:
            payload = json.loads(self.bot_token)
            if 'data' in payload:
                return self.env['erpv6.crypto.engine'].decrypt(self.bot_token)
        except (json.JSONDecodeError, TypeError):
            pass
        _logger.warning("Configurazione Telegram %s: bot_token non cifrato, migrare!", self.name)
        return self.bot_token

    # ------------------------------------------------------------------
    # Invio (Compito 6, 23/08/2026) -- codice reale, mai chiamato oggi
    # perche' nessun record ha is_active=True + bot_token reale.
    # ------------------------------------------------------------------

    def send_message(self, text, reply_markup=None, reply_to_message_id=None):
        """Invia un messaggio di testo alla chat configurata (sendMessage).
        Ritorna True/False -- non solleva mai un'eccezione al chiamante
        (stesso principio gia' seguito ovunque per i canali di notifica: un
        canale che fallisce non deve mai far fallire l'intero flusso che lo
        chiama), logga per intero l'errore reale.

        reply_markup (opzionale, 24/08/2026): dict Telegram nativo
        (es. {'inline_keyboard': [[{'text': '...', 'callback_data': '...'}]]})
        per bottoni cliccabili -- richiesto da Denis dopo aver visto il
        comando testuale 'approva N'/'rifiuta N' ("possibile che siano
        cliccabili?"). Vedi send_proposal_decision() per il caso d'uso
        concreto (proposte erpv6.agent.proposal).

        reply_to_message_id (opzionale, 25/08/2026): id nativo Telegram del
        messaggio a cui questo e' una risposta -- richiesto esplicitamente
        da Denis ("inizierò a usare il comando Telegram reply, vorrei che
        anche gli agenti lo usassero"), cosi' la risposta appare
        visivamente agganciata sotto il messaggio giusto invece che persa
        nel flusso piatto della chat quando ci sono piu' proposte/conferme
        in sospeso insieme. Se il messaggio originale non esiste piu' (es.
        cancellato), Telegram ignora il parametro e invia comunque il
        messaggio normalmente -- mai un fallimento per questo."""
        self.ensure_one()
        if not self.is_active or not self.bot_token or not self.chat_id:
            _logger.debug(
                "Configurazione Telegram %s non attiva/incompleta -- send_message() non invia nulla "
                "(is_active=%s, bot_token=%s, chat_id=%s).",
                self.name, self.is_active, bool(self.bot_token), bool(self.chat_id))
            return False
        token = self.get_decrypted_bot_token()
        if not token:
            _logger.warning("Configurazione Telegram %s: bot_token non decifrabile, invio saltato.", self.name)
            return False
        try:
            body = {'chat_id': self.chat_id, 'text': text}
            if reply_markup:
                body['reply_markup'] = reply_markup
            if reply_to_message_id:
                body['reply_parameters'] = {'message_id': reply_to_message_id, 'allow_sending_without_reply': True}
            response = requests.post(
                (TELEGRAM_API_BASE % token) + '/sendMessage',
                json=body,
                timeout=TELEGRAM_HTTP_TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
            if not payload.get('ok'):
                _logger.error("Telegram sendMessage per %s: risposta non ok: %s", self.name, payload)
                return False
            return True
        except Exception as e:
            _logger.error("Telegram sendMessage fallito per configurazione %s: %s", self.name, e)
            return False

    @api.model
    def _resolve_telegram_config_for_agent(self, agent_config):
        """Trova la configurazione Telegram REALE da cui inviare per questo
        agente: la sua propria se attiva, altrimenti quella di Susanna
        (fallback, vedi send_message_for_agent per il motivo). Fattorizzata
        il 25/08/2026 (costruzione di Alessandro) da dentro
        send_message_for_agent, per essere riusata anche da
        send_proposal_decision_for_agent: Kaizen non ha mai avuto un bot
        proprio, ma la sua proposta di escalation verso Alessandro ha
        comunque bisogno di veri bottoni Approva/Rifiuta cliccabili, stesso
        schema gia' in uso per Claudio (send_proposal_decision) -- niente
        di nuovo da duplicare, solo da riusare col fallback gia' esistente.

        Ritorna (config_da_usare, prefisso_testo) oppure (None, '') se
        nessun invio e' possibile (nessun bot proprio ne' di Susanna
        attivo)."""
        config = self.search([
            ('agent_config_id', '=', agent_config.id), ('is_active', '=', True), ('bot_token', '!=', False),
        ], limit=1)
        if config:
            return config, ''
        if agent_config.code == 'susanna':
            return self.browse(), ''
        susanna = self.env['erpv6.agent.config'].sudo().search([('code', '=', 'susanna')], limit=1)
        if not susanna:
            return self.browse(), ''
        susanna_config = self.search([
            ('agent_config_id', '=', susanna.id), ('is_active', '=', True), ('bot_token', '!=', False),
        ], limit=1)
        if not susanna_config:
            return self.browse(), ''
        return susanna_config, _("[%s, tramite Susanna]\n") % agent_config.name

    @api.model
    def send_message_for_agent(self, agent_config, text, reply_markup=None):
        """Punto di ingresso usato dal resto del sistema (es.
        erpv6.agent.confirmation._escalate, Compito 3): invia via Telegram
        SOLO se esiste una configurazione attiva collegata a quell'agente
        -- silenzioso (nessuna eccezione, nessun log di errore, solo debug)
        se non esiste, perche' e' il caso normale oggi (nessun token reale
        ancora fornito). Chiamare sempre dentro un try/except lato
        chiamante comunque, per difesa in profondita'.

        reply_markup (24/08/2026): passato cosi' com'e' a send_message --
        vedi erpv6.agent.confirmation._telegram_reply_markup per i bottoni
        Conferma/Procedi/Pianifica/Fermati.

        Fallback su Susanna (24/08/2026, richiesto esplicitamente da Denis:
        "Andrea e Sabrina se non hanno bot mi scrivono in Telegram tramite
        Susanna" -- oggi solo Susanna e Claudio hanno un bot Telegram reale
        configurato, verificato sul DB). Un agente senza bot proprio non
        resta piu' silenzioso: il messaggio parte comunque, dal bot di
        Susanna, con un prefisso che dice chi scrive davvero -- Susanna
        stessa non fa mai da fallback per se stessa (evita un loop se
        anche lei fosse priva di bot)."""
        config, prefix = self._resolve_telegram_config_for_agent(agent_config)
        if not config:
            return False
        return config.send_message(prefix + text, reply_markup=reply_markup)

    @api.model
    def _proposal_decision_reply_markup(self, proposal_id):
        """Bottoni Approva/Rifiuta per una erpv6.agent.proposal --
        fattorizzato il 25/08/2026 da dentro send_proposal_decision, per
        essere riusato identico da send_proposal_decision_for_agent (mai
        due copie dello stesso dizionario che potrebbero disallinearsi)."""
        return {
            'inline_keyboard': [[
                {'text': '✅ Approva', 'callback_data': 'approva:%d' % proposal_id},
                {'text': '❌ Rifiuta', 'callback_data': 'rifiuta:%d' % proposal_id},
            ]],
        }

    @api.model
    def send_proposal_decision_for_agent(self, agent_config, proposal_id, text):
        """Parallelo di send_proposal_decision (bottoni Approva/Rifiuta
        cliccabili) ma per un agente che potrebbe non avere un bot Telegram
        proprio (es. Kaizen) -- stesso fallback su Susanna di
        send_message_for_agent, stessi bottoni di send_proposal_decision,
        senza duplicare nessuna delle due logiche (vedi
        _resolve_telegram_config_for_agent e _proposal_decision_reply_markup).
        Aggiunto il 25/08/2026 per la proposta di escalation verso
        Alessandro (erpv6_kaizen._maybe_escalate_to_alessandro): Kaizen
        deve poter chiedere una vera decisione Approva/Rifiuta a Denis, non
        solo un avviso testuale."""
        config, prefix = self._resolve_telegram_config_for_agent(agent_config)
        if not config:
            return False
        return config.send_message(prefix + text, reply_markup=self._proposal_decision_reply_markup(proposal_id))

    # ------------------------------------------------------------------
    # Ricezione (Compito 6, 23/08/2026) -- polling, non webhook (vedi
    # docstring della classe per il motivo). Stesso principio gia' seguito
    # per i canali diretti Discuss (agent_config.py,
    # _check_direct_messages_on_channel): un messaggio umano nuovo genera
    # SEMPRE e SOLO una risposta conversazionale (answer_conversationally),
    # mai un'azione dedotta dal testo libero.
    # ------------------------------------------------------------------

    def _poll_updates(self):
        """Un giro di getUpdates per QUESTA configurazione: elabora ogni
        messaggio testuale nuovo proveniente dalla chat configurata (ignora
        update di altre chat -- un bot Telegram puo' ricevere messaggi da
        chiunque lo trovi, mai fidarsi di chat_id non configurato) e
        aggiorna last_update_id alla fine, cosi' il giro successivo non
        rielabora gli stessi update (l'API Telegram stessa li considera
        'confermati' non appena richiesti con un offset piu' alto)."""
        self.ensure_one()
        if not self.is_active or not self.bot_token or not self.chat_id:
            return
        token = self.get_decrypted_bot_token()
        if not token:
            return
        try:
            response = requests.get(
                (TELEGRAM_API_BASE % token) + '/getUpdates',
                params={'offset': self.last_update_id + 1, 'timeout': 0, 'limit': 50},
                timeout=TELEGRAM_HTTP_TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as e:
            _logger.error("Telegram getUpdates fallito per configurazione %s: %s", self.name, e)
            return
        if not payload.get('ok'):
            _logger.error("Telegram getUpdates per %s: risposta non ok: %s", self.name, payload)
            return
        results = payload.get('result') or []
        max_update_id = self.last_update_id
        for update in results:
            max_update_id = max(max_update_id, update.get('update_id', max_update_id))
            try:
                self._process_update(update)
            except Exception:
                _logger.exception(
                    "Elaborazione update Telegram #%s fallita per configurazione %s -- l'offset avanza "
                    "comunque (nessun ritentativo automatico sullo stesso update).",
                    update.get('update_id'), self.name)
        if max_update_id != self.last_update_id:
            self.last_update_id = max_update_id

    def send_proposal_decision(self, proposal_id, text):
        """send_message con due bottoni cliccabili (Approva/Rifiuta) invece
        del solo comando testuale 'approva N'/'rifiuta N' -- richiesto da
        Denis il 24/08/2026 ("possibile che siano cliccabili?"). callback_data
        resta comunque 'azione:id', stesso formato stretto del comando
        testuale (mai testo libero interpretato): il click e' solo un modo
        piu' comodo di mandare lo stesso comando esplicito."""
        self.ensure_one()
        return self.send_message(text, reply_markup=self._proposal_decision_reply_markup(proposal_id))

    def _answer_callback_query(self, callback_query_id):
        """Toglie lo stato 'in caricamento' dal bottone su Telegram dopo il
        click -- non influisce sulla logica (il comando e' gia' stato
        eseguito da _handle_proposal_decision), solo UX: senza questo il
        bottone resterebbe visivamente in sospeso. Best-effort, mai
        bloccante."""
        token = self.get_decrypted_bot_token()
        if not token:
            return
        try:
            requests.post(
                (TELEGRAM_API_BASE % token) + '/answerCallbackQuery',
                json={'callback_query_id': callback_query_id},
                timeout=TELEGRAM_HTTP_TIMEOUT,
            )
        except Exception:
            _logger.exception("answerCallbackQuery fallito (non bloccante) per %s.", self.name)

    def _process_update(self, update):
        """UN update in ingresso: solo messaggi testuali O click sui
        bottoni Approva/Rifiuta dalla chat_id configurata vengono elaborati
        (nessun'altra chat, nessun contenuto non testuale -- foto/documenti/
        sticker restano fuori perimetro). Genera sempre e solo una risposta
        conversazionale via agent_config_id.answer_conversationally (o
        un'approvazione/rifiuto SOLO per comando/click esplicito, mai
        un'azione dedotta dal testo libero) -- stesso vincolo non
        negoziabile gia' applicato ai canali Discuss."""
        self.ensure_one()
        callback_query = update.get('callback_query')
        if callback_query:
            chat_id = str(((callback_query.get('message') or {}).get('chat') or {}).get('id', ''))
            if not chat_id or chat_id != str(self.chat_id):
                _logger.warning(
                    "Telegram: click bottone da una chat NON configurata (%s) sulla configurazione "
                    "%s -- ignorato.", chat_id, self.name)
                return
            data = (callback_query.get('data') or '').strip()
            normalized = data.replace(':', ' ', 1)
            match = PROPOSAL_DECISION_RE.match(normalized)
            confirmation_match = CONFIRMATION_DECISION_RE.match(normalized)
            registra_match = REGISTRA_RE.match(normalized)
            self._answer_callback_query(callback_query.get('id'))
            if match and self.agent_config_id:
                self._handle_proposal_decision(match.group(1).lower(), int(match.group(2)))
            elif confirmation_match and self.agent_config_id:
                self._handle_confirmation_decision(confirmation_match.group(1).lower(), int(confirmation_match.group(2)))
            elif registra_match and self.agent_config_id:
                self._handle_registra(int(registra_match.group(1)) if registra_match.group(1) else None)
            else:
                _logger.warning("Telegram: callback_data non riconosciuto: %r su %s.", data, self.name)
            return
        message = update.get('message') or update.get('edited_message')
        if not message:
            return
        chat_id = str((message.get('chat') or {}).get('id', ''))
        if not chat_id or chat_id != str(self.chat_id):
            _logger.warning(
                "Telegram: messaggio ricevuto da una chat NON configurata (%s) sulla configurazione "
                "%s -- ignorato (chat_id atteso: %s).", chat_id, self.name, self.chat_id)
            return
        text = html2plaintext(message.get('text') or '').strip()
        if not text:
            return
        if not self.agent_config_id:
            _logger.warning(
                "Configurazione Telegram %s non collegata a nessun agente -- messaggio ricevuto ma "
                "nessuna risposta possibile.", self.name)
            return
        decision_match = PROPOSAL_DECISION_RE.match(text)
        if decision_match:
            self._handle_proposal_decision(decision_match.group(1).lower(), int(decision_match.group(2)))
            return
        confirmation_match = CONFIRMATION_DECISION_RE.match(text)
        if confirmation_match:
            self._handle_confirmation_decision(confirmation_match.group(1).lower(), int(confirmation_match.group(2)))
            return
        # Storico REALE persistito (24/08/2026, richiesto esplicitamente da
        # Denis: "le chat dovrebbero essere salvate, l'agente ha memoria
        # della comunicazione, e si possono imparare errori") - prima
        # thread_history era sempre '' (limite noto, mai risolto). chat_key
        # = chat_id Telegram: una conversazione per chat, mai mescolata con
        # altre chat sullo stesso bot.
        registra_match = REGISTRA_RE.match(text)
        if registra_match:
            self._handle_registra(int(registra_match.group(1)) if registra_match.group(1) else None)
            return
        ChatLog = self.env['erpv6.agent.chat.log']
        thread_history = ChatLog.log_and_get_history(self.env, self.agent_config_id.id, str(self.chat_id), text)
        answer, pending_action = self.agent_config_id.answer_conversationally(
            title=_("Telegram — %s") % self.agent_config_id.name,
            thread_history=thread_history,
            question_text=text,
        )
        log_entry = ChatLog.log_reply(
            self.env, self.agent_config_id.id, str(self.chat_id), answer, pending_action=pending_action)
        reply_markup = self._registra_reply_markup(log_entry) if pending_action else None
        self.send_message(answer, reply_markup=reply_markup, reply_to_message_id=message.get('message_id'))

    # Etichette per tipo (25/08/2026, richiesto esplicitamente da Denis:
    # "pulsante uguale ad azione" - il bottone deve dire DAVVERO cosa fa,
    # non un generico "Registra" uguale per tutto).
    _REGISTRA_BUTTON_LABELS = {
        'claudio': '📝 Assegna a Claudio',
        'alessandro': '📝 Assegna ad Alessandro',
        'kaizen_signal': '📝 Registra per Kaizen',
    }

    def _registra_reply_markup(self, chat_log_entry):
        label = self._REGISTRA_BUTTON_LABELS.get(chat_log_entry.pending_action_type, '📝 Registra')
        return {
            'inline_keyboard': [[
                {'text': label, 'callback_data': 'registra:%d' % chat_log_entry.id},
            ]],
        }

    def _handle_registra(self, chat_log_id):
        """Trasforma DAVVERO un'azione_proposta (mai eseguita dall'AI, solo
        dati inerti su erpv6.agent.chat.log) in un record reale - unico
        punto di scrittura per questo meccanismo, sempre codice
        deterministico, mai una nuova chiamata AI che "decide" cosa fare.
        chat_log_id esplicito (bottone, il caso normale) o None (comando
        testuale digitato, usa l'ultima azione non consumata)."""
        self.ensure_one()
        ChatLog = self.env['erpv6.agent.chat.log']
        if chat_log_id:
            entry = ChatLog.sudo().browse(chat_log_id)
            if not entry.exists() or not entry.pending_action_type:
                self.send_message(_("Non trovo nessuna azione proposta #%d da registrare.") % chat_log_id)
                return
        else:
            entry = ChatLog.find_pending_action(self.env, self.agent_config_id.id, str(self.chat_id))
            if not entry:
                self.send_message(_("Non c'è nessuna azione proposta in sospeso da registrare."))
                return
        if entry.pending_action_consumed:
            self.send_message(_("Questa azione è già stata registrata in precedenza."))
            return
        reviewer = self.env.ref('base.user_admin', raise_if_not_found=False) or self.env.user
        if entry.pending_action_type in ('claudio', 'alessandro'):
            target = self.env['erpv6.agent.config'].sudo().search(
                [('code', '=', entry.pending_action_type)], limit=1)
            if not target:
                self.send_message(_("Agente '%s' non trovato, registrazione annullata.") % entry.pending_action_type)
                return
            proposal = self.env['erpv6.agent.proposal'].sudo().create({
                'agent_config_id': target.id,
                'name': entry.pending_action_title or _('Richiesta da conversazione Telegram'),
                'proposal_text': entry.pending_action_description or entry.pending_action_title,
                'status': 'accepted',
                'reviewer_id': reviewer.id,
                'reviewed_at': fields.Datetime.now(),
            })
            ack = _("✅ Creata proposta #%(id)d per %(agent)s: %(title)s") % {
                'id': proposal.id, 'agent': target.name, 'title': proposal.name}
        else:  # kaizen_signal
            report = self.env['erpv6.kaizen.manual_report'].sudo().create({
                'name': entry.pending_action_title or _('Richiesta da conversazione Telegram'),
                'description': entry.pending_action_description or entry.pending_action_title,
                'severity': 'lieve',
                'reporter_id': reviewer.id,
            })
            ack = _("✅ Registrata segnalazione Kaizen #%(id)d: %(title)s") % {
                'id': report.id, 'title': report.name}
        entry.pending_action_consumed = True
        self.send_message(ack)

    def _handle_proposal_decision(self, decision, proposal_id):
        """Approva/rifiuta DAVVERO una erpv6.agent.proposal da un comando
        Telegram esplicito ('approva N'/'rifiuta N') - vedi PROPOSAL_DECISION_RE.
        Scope limitato alla proposta di QUESTO agente, TRANNE Susanna
        (24/08/2026, richiesto esplicitamente: "Susanna mi scrive la
        proposta di Kaizen, io approvo o rifiuto come sempre") - lei e'
        l'orchestratrice, autorizzata a far decidere Denis su proposte di
        qualunque agente, non solo le sue. Sempre una risposta chiara, mai
        un silenzio anche in caso di errore/ambiguita' -- Denis deve
        sempre sapere se e' stato ascoltato."""
        self.ensure_one()
        proposal = self.env['erpv6.agent.proposal'].sudo().browse(proposal_id)
        if not proposal.exists():
            self.send_message(_("Non trovo nessuna proposta #%d.") % proposal_id)
            return
        if proposal.agent_config_id.id != self.agent_config_id.id and self.agent_config_id.code != 'susanna':
            self.send_message(_(
                "La proposta #%(id)d non è di %(agent)s (questo canale) — non la tocco da qui."
            ) % {'id': proposal_id, 'agent': self.agent_config_id.name})
            return
        if proposal.status != 'pending_review':
            self.send_message(_(
                "La proposta #%(id)d non è più in attesa (stato attuale: %(status)s) — nessuna azione."
            ) % {'id': proposal_id, 'status': proposal.status})
            return
        reviewer = self.env.ref('base.user_admin', raise_if_not_found=False) or self.env.user
        if decision == 'approva':
            # La catena verso Claudio (se questa non e' gia' una sua
            # proposta) scatta DENTRO write() su erpv6.agent.proposal
            # stesso, non qui - corretto il 24/08/2026 dopo aver trovato
            # che approvare da Odoo (non da Telegram) non la faceva mai
            # scattare, perche' viveva solo in questo metodo.
            proposal.sudo().write({
                'status': 'accepted', 'reviewer_id': reviewer.id, 'reviewed_at': fields.Datetime.now(),
            })
            # Bug reale trovato e corretto il 25/08/2026 (verifica dal vivo
            # dei bottoni di Sabrina, stessa sessione): questo messaggio
            # diceva il nome del CANALE che aveva approvato (es. 'Susanna',
            # autorizzata ad approvare proposte di chiunque) invece
            # dell'agente che avrebbe DAVVERO applicato la modifica --
            # _next_chain_agent_code() e' la stessa funzione che decide a
            # chi incatenare in agent_proposal.py, non puo' piu'
            # disallinearsi da qui.
            next_agent = self.env['erpv6.agent.config'].sudo().search(
                [('code', '=', proposal.sudo()._next_chain_agent_code())], limit=1)
            self.send_message(_(
                "✅ Proposta #%d approvata. %s se ne occupa a breve, ti avviso quando è fatto."
            ) % (proposal_id, next_agent.name if next_agent else _("Qualcuno")))
        else:
            # NON action_reject(): quel metodo usa self.env.user, che qui e'
            # l'utente tecnico del cron/shell che ha ricevuto l'update
            # Telegram, non Denis - scoperto il 24/08/2026 controllando il
            # reviewer_id reale dopo un rifiuto vero (risultava #1,
            # OdooBot/tecnico, non l'admin). write() esplicito con lo stesso
            # 'reviewer' gia' usato per l'approvazione, per coerenza.
            proposal.sudo().write({
                'status': 'rejected', 'reviewer_id': reviewer.id, 'reviewed_at': fields.Datetime.now(),
            })
            self.send_message(_("❌ Proposta #%d rifiutata, non verrà applicata.") % proposal_id)

    def _handle_confirmation_decision(self, decision, confirmation_id):
        """Parallelo di _handle_proposal_decision per erpv6.agent.confirmation
        (24/08/2026, richiesto esplicitamente da Denis dopo aver scoperto
        che le conferme di Sabrina/Andrea non erano cliccabili come le
        proposte: "anche loro devono avere accetta rifiuta"). Stesso scope
        (solo l'agente proprietario, TRANNE Susanna) e stesso principio
        (parola chiave chiusa + id, mai testo libero). Chiama DAVVERO
        _do_confirm/_do_phase_decision (stesso codice gia' usato dal
        gestore Discuss, vedi agent_confirmation.py._check_for_confirmation)
        -- non un secondo meccanismo parallelo che potrebbe disallinearsi."""
        self.ensure_one()
        confirmation = self.env['erpv6.agent.confirmation'].sudo().browse(confirmation_id)
        if not confirmation.exists():
            self.send_message(_("Non trovo nessuna conferma #%d.") % confirmation_id)
            return
        if confirmation.agent_config_id.id != self.agent_config_id.id and self.agent_config_id.code != 'susanna':
            self.send_message(_(
                "La conferma #%(id)d non è di %(agent)s (questo canale) — non la tocco da qui."
            ) % {'id': confirmation_id, 'agent': self.agent_config_id.name})
            return
        if confirmation.state != 'pending':
            self.send_message(_(
                "La conferma #%(id)d non è più in attesa (stato attuale: %(state)s) — nessuna azione."
            ) % {'id': confirmation_id, 'state': confirmation.state})
            return
        is_phase = decision in ('procedi', 'pianifica', 'fermati')
        expected_type = 'phase_decision' if is_phase else 'confirm'
        if confirmation.decision_type != expected_type:
            self.send_message(_(
                "La conferma #%(id)d non accetta '%(decision)s' (è di tipo %(type)s) — nessuna azione."
            ) % {'id': confirmation_id, 'decision': decision, 'type': confirmation.decision_type})
            return
        reviewer = self.env.ref('base.user_admin', raise_if_not_found=False) or self.env.user
        if is_phase:
            ack_text = confirmation._do_phase_decision(reviewer, decision)
        else:
            ack_text = confirmation._do_confirm(reviewer)
        self.send_message(ack_text)

    @api.model
    def _cron_poll_telegram_updates(self):
        """Cron condiviso (stesso principio di _cron_check_agent_direct_messages
        in agent_config.py): scansiona TUTTE le configurazioni attive con un
        bot_token -- oggi sempre zero (is_active resta False finche' Denis
        non fornisce un token reale, vedi note_placeholder), quindi questo
        giro e' sempre una query vuota senza nessuna chiamata HTTP. Pronto a
        funzionare automaticamente appena una configurazione reale viene
        attivata, senza toccare nessun cron XML."""
        configs = self.search([('is_active', '=', True), ('bot_token', '!=', False)])
        for config in configs:
            try:
                config._poll_updates()
            except Exception:
                _logger.exception(
                    "Polling Telegram fallito per configurazione %s -- riprovera' al prossimo giro.", config.name)
