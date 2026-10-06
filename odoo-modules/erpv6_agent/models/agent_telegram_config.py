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

# C1b-bot-1 (02/10/2026): decisione su erpv6.suggestion da bottone inline.
# data telegram = "sugg:accept:123" → normalizzata a "sugg accept 123".
SUGG_DECISION_RE = re.compile(r'^sugg (accept|ignore) (\d+)$')

# 03/10/2026 (C1b-agenda-COMPLETE-C): decisione su calendar.attendee.
# data telegram = "cal:accept:123" → normalizzata a "cal accept 123".
CAL_DECISION_RE = re.compile(r'^cal (accept|decline) (\d+)$')

# 03/10/2026 (C5-P3): decisione su erpv6.signal.
# data telegram = "sig:accept:42" → normalizzata a "sig accept 42".
SIG_DECISION_RE = re.compile(r'^sig (accept|ignore|silence) (\d+)$')

# Reazione che fa scattare l'autocritica (25/08/2026, richiesta esplicita di
# Denis) -- SOLO questo emoji, mai un'interpretazione libera di "reazione
# negativa" (stesso principio non negoziabile gia' seguito per i comandi
# testuali sopra: vocabolario chiuso, non dedotto).
NEGATIVE_REACTION_EMOJI = '\U0001F44E'  # 👎

# Update types richiesti esplicitamente via allowed_updates (Compito 6,
# 23/08/2026 + feature reazione 25/08/2026). Verificato sulla documentazione
# ufficiale Telegram Bot API (core.telegram.org/bots/api#getupdates,
# 25/08/2026): "Specify an empty list to receive all update types except
# chat_member, message_reaction, and message_reaction_count (default)" --
# quindi 'message_reaction' NON arriverebbe mai senza elencarlo qui
# esplicitamente, e specificare QUALUNQUE lista non vuota disattiva tutti i
# tipi non elencati: bisogna rielencare anche i tre gia' in uso
# (message/edited_message/callback_query), non solo aggiungere il nuovo.
TELEGRAM_ALLOWED_UPDATES = ['message', 'edited_message', 'callback_query', 'message_reaction']


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
    # 07/10/2026 (C-telegram-otp-bot-1): distingue bot operativo
    # (Susanna/Claudio) da bot OTP dedicato (V6 Auth). Il polling
    # e _process_update diramano su mode.
    mode = fields.Selection([
        ('operativo', 'Operativo (Susanna/Claudio)'),
        ('otp', 'Solo OTP (V6 Auth)'),
    ], string='Modalita', default='operativo', required=True,
       help='Operativo: riceve messaggi agenti, comandi, callback. '
            'OTP: accetta solo /start <token> per mappare chat a utente.')

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

    def send_message(self, text, reply_markup=None, reply_to_message_id=None, return_message_id=False, chat_id_override=None):
        """Invia un messaggio di testo alla chat configurata (sendMessage).
        Ritorna True/False -- non solleva mai un'eccezione al chiamante
        (stesso principio gia' seguito ovunque per i canali di notifica: un
        canale che fallisce non deve mai far fallire l'intero flusso che lo
        chiama), logga per intero l'errore reale.

        return_message_id (opzionale, 25/08/2026, feature reazione 👎):
        se True, ritorna l'id nativo Telegram del messaggio appena inviato
        (result.message_id della risposta sendMessage) al posto di True, o
        None al posto di False -- serve a chi chiama per valorizzare
        erpv6.agent.chat.log.telegram_message_id sul record 'out'
        corrispondente, cosi' una futura reazione Telegram su quel
        messaggio puo' risalire al testo giusto (vedi
        find_by_telegram_message_id). Default False per non cambiare il
        contratto di ritorno per nessuno dei chiamanti esistenti (nessuno
        di loro legge il valore ritornato oltre a un controllo di verita').

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
        failure = None if return_message_id else False
        if not self.is_active or not self.bot_token or not (chat_id_override or self.chat_id):
            _logger.debug(
                "Configurazione Telegram %s non attiva/incompleta -- send_message() non invia nulla "
                "(is_active=%s, bot_token=%s, chat_id=%s).",
                self.name, self.is_active, bool(self.bot_token), bool(self.chat_id))
            return failure
        token = self.get_decrypted_bot_token()
        if not token:
            _logger.warning("Configurazione Telegram %s: bot_token non decifrabile, invio saltato.", self.name)
            return failure
        try:
            body = {'chat_id': chat_id_override or self.chat_id, 'text': text}
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
                return failure
            if return_message_id:
                return (payload.get('result') or {}).get('message_id')
            return True
        except Exception as e:
            _logger.error("Telegram sendMessage fallito per configurazione %s: %s", self.name, e)
            return failure

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
                params={
                    'offset': self.last_update_id + 1, 'timeout': 0, 'limit': 50,
                    'allowed_updates': json.dumps(TELEGRAM_ALLOWED_UPDATES),
                },
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

    def _edit_message_reply_markup(self, chat_id, message_id, reply_markup=None):
        """Rimuove/aggiorna la tastiera inline. Best-effort."""
        token = self.get_decrypted_bot_token()
        if not token:
            return
        try:
            if reply_markup is None:
                reply_markup = {'inline_keyboard': []}
            requests.post(
                (TELEGRAM_API_BASE % token) + '/editMessageReplyMarkup',
                json={
                    'chat_id': chat_id,
                    'message_id': message_id,
                    'reply_markup': reply_markup,
                },
                timeout=TELEGRAM_HTTP_TIMEOUT,
            )
        except Exception:
            _logger.exception("editMessageReplyMarkup fallito (non bloccante) per %s.", self.name)

    def _handle_suggestion_decision(self, action, sugg_id, chat_id, message_id, callback_query_id):
        """C1b-bot-1: accept/ignore su erpv6.suggestion da bottone."""
        user = self.env['res.users'].sudo().search([
            ('telegram_chat_id', '=', chat_id)
        ], limit=1)
        if not user and str(chat_id) == str(self.chat_id):
            user = self.env['res.users'].sudo().browse(2)
        if not user:
            self._answer_callback_query(callback_query_id)
            return

        suggestion = self.env['erpv6.suggestion'].sudo().browse(sugg_id)
        if not suggestion.exists() or suggestion.user_id.id != user.id:
            self._answer_callback_query(callback_query_id)
            return
        if suggestion.state in ('accepted', 'ignored', 'expired'):
            self._answer_callback_query(callback_query_id)
            return

        followup_msg = None
        if action == 'accept':
            # C1b-bot-2: azione centralizzata (crea TODO se urgent/attention)
            todo = suggestion.action_accept()
            if todo:
                followup_msg = f"✅ Accettata. TODO #{todo.id} creato (scadenza {todo.due_date})."
            else:
                followup_msg = "✅ Accettata."
        elif action == 'ignore':
            suggestion.action_ignore()
            followup_msg = "❌ Ignorata."

        self._answer_callback_query(callback_query_id)
        self._edit_message_reply_markup(chat_id, message_id, None)
        # 03/10/2026 (C1b-bot-2): messaggio di conferma separato
        if followup_msg:
            try:
                self.send_message(followup_msg, chat_id_override=chat_id)
            except Exception:
                _logger.exception(
                    "Telegram: follow-up suggestion decisione fallito per %s.",
                    self.name)

    def _handle_calendar_decision(self, action, attendee_id, chat_id,
                                    message_id, callback_query_id):
        """03/10/2026 (C1b-agenda-COMPLETE-C): accept/decline su
        calendar.attendee da bottoni Telegram.

        Estensione (A, richiesta master): dopo accept, invia messaggio
        con link Google Calendar + .ics per aggiungere l'evento al
        calendario personale. Solo dati pubblici dell'evento
        (name/start/stop/location/description), MAI contesto V6."""
        user = self.env['res.users'].sudo().search([
            ('telegram_chat_id', '=', chat_id)
        ], limit=1)
        if not user:
            self._answer_callback_query(callback_query_id)
            return

        attendee = self.env['calendar.attendee'].sudo().browse(attendee_id)
        if not attendee.exists() or \
                attendee.partner_id.id != user.partner_id.id:
            self._answer_callback_query(callback_query_id)
            return

        new_state = 'accepted' if action == 'accept' else 'declined'
        attendee.write({'state': new_state})
        event = attendee.event_id

        self._answer_callback_query(callback_query_id)
        self._edit_message_reply_markup(chat_id, message_id, None)

        # Messaggio di conferma + link calendario (solo se accept)
        label = '✅ Accettato' if action == 'accept' else '❌ Rifiutato'
        text = f"{label}: {event.name}"

        if action == 'accept':
            # Riga con dettagli evento (data/ora/luogo)
            try:
                from odoo import fields as odoo_fields
                start_local = odoo_fields.Datetime.context_timestamp(
                    user, event.start)
                end_local = odoo_fields.Datetime.context_timestamp(
                    user, event.stop)
                text += (
                    f"\n🕐 {start_local.strftime('%d/%m %H:%M')} – "
                    f"{end_local.strftime('%H:%M')}"
                )
                if event.location:
                    text += f"\n📍 {event.location}"
            except Exception:  # pylint: disable=broad-except
                _logger.debug("Errore formattazione dettagli evento")

            # Link Google Calendar + .ics (solo dati pubblici - ADDENDUM)
            # 03/10/2026: Telegram rifiuta URL localhost. Usare un
            # param dedicato invece di web.base.url (che in dev/prod
            # interno è localhost:8069).
            base_url = self.env['ir.config_parameter'].sudo().get_param(
                'v6.public.base_url', 'https://erpv6.it')

            def _fmt_gcal(dt):
                """Datetime UTC naive → formato Google YYYYMMDDTHHmmssZ."""
                return dt.strftime('%Y%m%dT%H%M%SZ')

            from urllib.parse import urlencode
            params = {
                'action': 'TEMPLATE',
                'text': event.name or '',
                'dates': f"{_fmt_gcal(event.start)}/{_fmt_gcal(event.stop)}",
                'location': event.location or '',
                # ADDENDUM: solo description, mai contesto V6
                'details': event.description or '',
            }
            gcal_url = (
                'https://calendar.google.com/calendar/render?'
                + urlencode(params)
            )
            ics_url = f"{base_url}/api/v1/admin/appointments/{event.id}/ics"

            try:
                self.send_message(
                    text=text,
                    chat_id_override=chat_id,
                    reply_markup={'inline_keyboard': [[
                        {'text': '📆 Google Calendar', 'url': gcal_url},
                        {'text': '📥 .ics', 'url': ics_url},
                    ]]},
                )
                return
            except Exception:  # pylint: disable=broad-except
                _logger.exception(
                    "Telegram: invio conferma calendario con bottoni URL "
                    "fallito (provo testo semplice)")

        # Fallback: testo semplice (decline o errore)
        try:
            self.send_message(text, chat_id_override=chat_id)
        except Exception:  # pylint: disable=broad-except
            _logger.exception(
                "Telegram: follow-up calendar decisione fallito per %s.",
                self.name)

    def _handle_signal_decision(self, action, signal_id, chat_id,
                                  message_id, callback_query_id):
        """03/10/2026 (C5-P3): accept/ignore/silence su erpv6.signal da
        bottoni Telegram.

        - accept: state='acknowledged'
        - ignore: state='ignored' + register_ignore (mute dopo 3)
        - silence: action_silence_30d (mute manuale 30gg)
        """
        user = self.env['res.users'].sudo().search([
            ('telegram_chat_id', '=', chat_id)
        ], limit=1)
        if not user:
            self._answer_callback_query(callback_query_id)
            return

        signal = self.env['erpv6.signal'].sudo().browse(signal_id)
        if not signal.exists():
            self._answer_callback_query(callback_query_id)
            return
        # Verifica: il signal deve essere assegnato all'utente o a lui accessibile
        if signal.recipient_user_id and signal.recipient_user_id.id != user.id:
            self._answer_callback_query(callback_query_id)
            return

        label = ''
        try:
            if action == 'accept':
                signal.action_acknowledge()
                label = f"✅ Preso in carico: {signal.title[:60]}"
            elif action == 'ignore':
                signal.action_ignore()
                label = f"❌ Ignorato: {signal.title[:60]}"
            elif action == 'silence':
                signal.action_silence_30d()
                label = f"🔕 Silenziato 30gg: {signal.title[:60]}"
            self.env.cr.commit()
        except Exception:  # pylint: disable=broad-except
            _logger.exception(
                "Telegram: _handle_signal_decision fallito per signal %s",
                signal_id)
            label = "⚠️ Errore nell'azione, riprova da Odoo."

        self._answer_callback_query(callback_query_id)
        self._edit_message_reply_markup(chat_id, message_id, None)
        try:
            self.send_message(label, chat_id_override=chat_id)
        except Exception:  # pylint: disable=broad-except
            _logger.exception("Follow-up signal decision fallito")

    def _handle_start_registration(self, chat_id, text):
        """C1b-bot-1: gestione /start. Se già registrato, saluta;
        altrimenti chiede l'email V6 e salva stato pending."""
        user = self.env['res.users'].sudo().search([
            ('telegram_chat_id', '=', chat_id)
        ], limit=1)
        if user:
            self.send_message(
                f"Ciao {user.name}, sei già registrato. "
                f"Riceverai qui le azioni urgenti V6.",
                chat_id_override=chat_id,
            )
            return

        # Utente legacy (chat_id == config.chat_id): è Denis
        if str(chat_id) == str(self.chat_id):
            self.send_message(
                "Ciao Denis, sei già configurato. "
                "Riceverai qui le azioni urgenti V6.",
                chat_id_override=chat_id,
            )
            return

        # Nuovo utente: chiedi email
        self.send_message(
            "Ciao! Per registrarti manda la tua email V6 "
            "(quella con cui accedi alla dashboard).",
            chat_id_override=chat_id,
        )
        self.env['ir.config_parameter'].sudo().set_param(
            f'telegram.pending.{chat_id}', '1')

    def _is_pending_registration(self, chat_id):
        return bool(self.env['ir.config_parameter'].sudo().get_param(
            f'telegram.pending.{chat_id}'))

    def _handle_email_registration(self, chat_id, text):
        """C1b-bot-1: riceve l'email di registrazione e associa chat_id."""
        email = (text or '').strip().lower()
        user = self.env['res.users'].sudo().search([
            ('login', '=', email),
            ('active', '=', True),
        ], limit=1)

        if user and not user.telegram_chat_id:
            user.write({
                'telegram_chat_id': chat_id,
                'telegram_registered_at': fields.Datetime.now(),
            })
            self.env['ir.config_parameter'].sudo().search([
                ('key', '=', f'telegram.pending.{chat_id}')
            ]).unlink()
            self.send_message(
                f"Registrato come {user.name}. Riceverai qui "
                f"le azioni urgenti V6.",
                chat_id_override=chat_id,
            )
        elif user and user.telegram_chat_id:
            self.send_message(
                f"{user.name} è già associato a un altro chat_id. "
                f"Contatta un admin.",
                chat_id_override=chat_id,
            )
        else:
            self.send_message(
                "Email non trovata. Riprova (o /start).",
                chat_id_override=chat_id,
            )

    def _process_update(self, update):
        """UN update in ingresso: solo messaggi testuali, click sui bottoni
        Approva/Rifiuta, O reazioni 👎 (25/08/2026, vedi
        _process_reaction_update) dalla chat_id configurata vengono
        elaborati (nessun'altra chat, nessun contenuto non testuale --
        foto/documenti/sticker restano fuori perimetro). Genera sempre e
        solo una risposta conversazionale via
        agent_config_id.answer_conversationally, un'autocritica via
        reflect_on_negative_feedback, (o un'approvazione/rifiuto SOLO per
        comando/click esplicito) -- mai un'azione dedotta dal testo libero,
        stesso vincolo non negoziabile gia' applicato ai canali Discuss."""
        self.ensure_one()
        # 07/10/2026 (C-telegram-otp-bot-1): dirama su handler OTP se
        # questa config e' un bot OTP (V6 Auth). Il bot OTP accetta
        # /start <token> anche da chat sconosciute: e' il flusso di
        # prima mappatura.
        if getattr(self, 'mode', 'operativo') == 'otp':
            return self._process_otp_update(update)

        reaction_update = update.get('message_reaction')
        if reaction_update:
            self._process_reaction_update(reaction_update)
            return
        callback_query = update.get('callback_query')
        if callback_query:
            chat_id = str(((callback_query.get('message') or {}).get('chat') or {}).get('id', ''))
            authorized = (
                chat_id and (
                    chat_id == str(self.chat_id)
                    or self.env['res.users'].sudo().search_count([
                        ('telegram_chat_id', '=', chat_id)
                    ]) > 0
                )
            )
            if not authorized:
                _logger.warning(
                    "Telegram: click bottone da chat NON autorizzata (%s) su %s -- ignorato.",
                    chat_id, self.name)
                return
            data = (callback_query.get('data') or '').strip()
            normalized = data.replace(':', ' ')  # C1b-bot-1: replace ALL (era 1)
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
                sugg_match = SUGG_DECISION_RE.match(normalized)
                if sugg_match:
                    self._handle_suggestion_decision(
                        sugg_match.group(1),
                        int(sugg_match.group(2)),
                        chat_id,
                        (callback_query.get('message') or {}).get('message_id'),
                        callback_query.get('id'),
                    )
                else:
                    cal_match = CAL_DECISION_RE.match(normalized)
                    if cal_match:
                        self._handle_calendar_decision(
                            cal_match.group(1),
                            int(cal_match.group(2)),
                            chat_id,
                            (callback_query.get('message') or {}).get('message_id'),
                            callback_query.get('id'),
                        )
                    else:
                        sig_match = SIG_DECISION_RE.match(normalized)
                        if sig_match:
                            self._handle_signal_decision(
                                sig_match.group(1),
                                int(sig_match.group(2)),
                                chat_id,
                                (callback_query.get('message') or {}).get('message_id'),
                                callback_query.get('id'),
                            )
                        else:
                            _logger.warning("Telegram: callback_data non riconosciuto: %r su %s.", data, self.name)
            return
        message = update.get('message') or update.get('edited_message')
        if not message:
            return
        chat_id = str((message.get('chat') or {}).get('id', ''))
        text_early = html2plaintext(message.get('text') or '').strip()

        # 02/10/2026 (C1b-bot-1): /start + email di registrazione
        # PRIMA della whitelist (altrimenti un utente nuovo non può
        # mai registrarsi).
        if text_early == '/start':
            self._handle_start_registration(chat_id, text_early)
            return
        if self._is_pending_registration(chat_id):
            self._handle_email_registration(chat_id, text_early)
            return

        authorized = (
            chat_id and (
                chat_id == str(self.chat_id)
                or self.env['res.users'].sudo().search_count([
                    ('telegram_chat_id', '=', chat_id)
                ]) > 0
            )
        )
        if not authorized:
            _logger.warning(
                "Telegram: messaggio da chat NON autorizzata (%s) su %s -- ignorato.",
                chat_id, self.name)
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
        # Fallback 👎 via reply testuale (25/08/2026, richiesto esplicitamente
        # da Denis dopo aver scoperto che la vera reazione Telegram non
        # funziona in chat privata: "piuttosto che mettere l'emotion così
        # rispondo al messaggio con l'emotion"). Un normale messaggio "👎"
        # (da solo, o seguito dal motivo: "👎 hai sbagliato il nome del
        # cliente" - richiesto subito dopo esplicitamente da Denis) mandato
        # in RISPOSTA (reply_to_message, sempre presente in una chat privata
        # indipendentemente dalla privacy mode dei bot) innesca la STESSA
        # autocritica reale di _process_reaction_update - vocabolario chiuso
        # sul PREFISSO (solo questo emoji all'inizio, mai dedotto da
        # qualunque altro segnale), stesso metodo condiviso
        # _handle_negative_feedback. Se Denis scrive solo il motivo SENZA
        # l'emoji, o l'emoji NON in risposta a un messaggio, resta testo
        # conversazionale normale -- il cancelletto e' sempre l'emoji.
        reply_to = message.get('reply_to_message') or {}
        if text.startswith(NEGATIVE_REACTION_EMOJI) and reply_to.get('message_id'):
            denis_reason = text[len(NEGATIVE_REACTION_EMOJI):].strip() or None
            self._handle_negative_feedback(reply_to['message_id'], denis_reason=denis_reason)
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
        sent_message_id = self.send_message(
            answer, reply_markup=reply_markup, reply_to_message_id=message.get('message_id'),
            return_message_id=True)
        if sent_message_id:
            log_entry.telegram_message_id = sent_message_id

    @staticmethod
    def _reaction_emojis(reaction_list):
        """Estrae gli emoji da un array di ReactionType (formato reale
        MessageReactionUpdated.old_reaction/new_reaction, verificato sulla
        documentazione ufficiale Telegram Bot API il 25/08/2026:
        [{'type': 'emoji', 'emoji': '👍'}, ...] -- un ReactionType puo' anche
        essere di type 'custom_emoji' o 'paid' (nessun campo 'emoji' in
        quei casi, .get() torna None e viene scartato qui, mai un errore)."""
        return {item.get('emoji') for item in (reaction_list or []) if item.get('type') == 'emoji'}

    def _process_reaction_update(self, reaction_update):
        """UN update Telegram di tipo 'message_reaction' (MessageReactionUpdated,
        vedi TELEGRAM_ALLOWED_UPDATES sopra per come viene richiesto in
        allowed_updates). Struttura reale verificata sulla documentazione
        ufficiale (core.telegram.org/bots/api#messagereactionupdated,
        25/08/2026): {'chat': {...}, 'message_id': int, 'user': {...}
        (opzionale), 'actor_chat': {...} (opzionale), 'date': int,
        'old_reaction': [ReactionType...], 'new_reaction': [ReactionType...]}
        -- MAI il testo del messaggio originale, solo chat+message_id: va
        sempre recuperato da erpv6.agent.chat.log via telegram_message_id
        (vedi find_by_telegram_message_id).

        Scatta SOLO se 👎 e' NUOVO in new_reaction rispetto a old_reaction
        (un umano che aggiunge/cambia un'altra reazione mentre 👎 resta gia'
        presente da prima non deve ritriggerare l'autocritica una seconda
        volta) -- stesso principio di vocabolario chiuso gia' seguito per i
        comandi testuali (mai dedurre 'e' negativo' da qualunque altro
        segnale).

        LIMITE REALE VERIFICATO IL 25/08/2026 (non un'ipotesi): la
        documentazione ufficiale Telegram dice esplicitamente "The bot must
        be an administrator in the chat" per ricevere questo tipo di
        update. Uno stato di amministratore non esiste per una chat privata
        1:1 bot<->utente (e' un concetto solo di gruppi/canali) -- verificato
        dal vivo che le configurazioni Susanna e Claudio oggi puntano
        entrambe a una chat_id di tipo 'private' (getChat confermato in
        sessione). In pratica questo significa che Telegram NON invierà mai
        questo update per una reazione di Denis nella chat privata attuale,
        indipendentemente da questo codice -- il codice qui e' comunque
        corretto e pronto (stessa logica che scatterebbe in un gruppo dove
        il bot fosse promosso amministratore, o se Telegram cambiasse
        comportamento in futuro), ma NON e' oggi azionabile da una reazione
        vera nella chat privata Denis<->bot senza cambiare il tipo di chat.
        Vedi il report di verifica per i dettagli."""
        self.ensure_one()
        chat_id = str((reaction_update.get('chat') or {}).get('id', ''))
        if not chat_id or chat_id != str(self.chat_id):
            _logger.warning(
                "Telegram: reazione ricevuta da una chat NON configurata (%s) sulla configurazione "
                "%s -- ignorata.", chat_id, self.name)
            return
        if not self.agent_config_id:
            _logger.warning(
                "Configurazione Telegram %s non collegata a nessun agente -- reazione ricevuta ma "
                "nessuna autocritica possibile.", self.name)
            return
        old_emojis = self._reaction_emojis(reaction_update.get('old_reaction'))
        new_emojis = self._reaction_emojis(reaction_update.get('new_reaction'))
        if NEGATIVE_REACTION_EMOJI not in new_emojis or NEGATIVE_REACTION_EMOJI in old_emojis:
            return  # non e' un NUOVO 👎 -- niente da fare (vedi docstring)
        self._handle_negative_feedback(reaction_update.get('message_id'))

    def _handle_negative_feedback(self, message_id, denis_reason=None):
        """Logica CONDIVISA dell'autocritica su un messaggio flaggato -
        fattorizzata il 25/08/2026 per essere riusata sia da una vera
        reazione 👎 (_process_reaction_update, oggi non azionabile in chat
        privata, vedi limite sopra) sia dal fallback che Denis ha chiesto
        subito dopo aver scoperto quel limite: "piuttosto che mettere
        l'emotion così rispondo al messaggio con l'emotion" - un normale
        messaggio di testo "👎" mandato in RISPOSTA (reply) al messaggio da
        criticare, che funziona identico in chat privata senza bisogno di
        nessun permesso speciale di Telegram.

        denis_reason (opzionale): il motivo che Denis ha scritto subito
        dopo l'emoji (es. "👎 hai sbagliato il nome del cliente") - se
        presente, l'AI lo usa come base invece di indovinare (vedi
        reflect_on_negative_feedback); una vera reazione Telegram non porta
        mai testo, quindi resta sempre None su quel percorso."""
        self.ensure_one()
        ChatLog = self.env['erpv6.agent.chat.log']
        flagged_entry = ChatLog.find_by_telegram_message_id(
            self.env, self.agent_config_id.id, str(self.chat_id), message_id)
        if not flagged_entry:
            _logger.warning(
                "Telegram: 👎 su message_id %s (config %s) ma nessun messaggio corrispondente "
                "nello storico (probabilmente precedente all'introduzione di telegram_message_id) -- "
                "avviso Denis invece di restare in silenzio.", message_id, self.name)
            self.send_message(_(
                "Ho visto il tuo 👎 ma non trovo il testo esatto di quel messaggio nel mio "
                "storico (probabilmente è precedente a quando ho iniziato a registrarli) -- dimmi tu "
                "cosa non andava, così lo tengo a mente."
            ), reply_to_message_id=message_id)
            return
        thread_history = ChatLog.get_history_text(self.env, self.agent_config_id.id, str(self.chat_id))
        reasoning = self.agent_config_id.reflect_on_negative_feedback(
            flagged_text=flagged_entry.text, thread_history=thread_history, denis_reason=denis_reason)
        log_entry = ChatLog.log_reply(self.env, self.agent_config_id.id, str(self.chat_id), reasoning)
        sent_message_id = self.send_message(reasoning, reply_to_message_id=message_id, return_message_id=True)
        if sent_message_id:
            log_entry.telegram_message_id = sent_message_id

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
    # ═══════════════════════════════════════════════════════════════
    # 07/10/2026 (C-telegram-otp-bot-1): metodi bot OTP.
    # ═══════════════════════════════════════════════════════════════

    def _send_otp_message(self, chat_id, text):
        """Wrapper a send_message per il bot OTP."""
        return self.send_message(text, chat_id_override=str(chat_id))

    def _process_otp_update(self, update):
        """Processa un update del bot OTP (V6 Auth).
        Accetta SOLO messaggi /start <token>. Ignora tutto il resto
        con messaggio di aiuto."""
        message = update.get('message') or update.get('edited_message')
        if not message:
            return
        chat = message.get('chat') or {}
        chat_id = str(chat.get('id') or '')
        if not chat_id:
            return
        text = html2plaintext(message.get('text') or '').strip()

        # Non-command: risposta informativa (utente ha scritto senza /start)
        if not text.startswith('/start'):
            self._send_otp_message(
                chat_id,
                "Ciao! Per certificare questa chat, apri l'app V6 e "
                "clicca 'Installa bot OTP' (genera un link monouso). "
                "Poi torna qui.")
            return

        parts = text.split(maxsplit=1)
        if len(parts) < 2 or not parts[1].strip():
            self._send_otp_message(
                chat_id,
                "Ciao! Per certificare questa chat, apri l'app V6 e "
                "clicca 'Installa bot OTP' (genera un link monouso). "
                "Poi torna qui.")
            return

        token = parts[1].strip()
        Token = self.env['erpv6.otp.bot.token'].sudo()
        t = Token.search([
            ('token', '=', token),
            ('used', '=', False),
            ('expires_at', '>', fields.Datetime.now()),
        ], limit=1)
        if not t:
            self._send_otp_message(
                chat_id,
                "Codice non valido o scaduto. Rigenera il link dalla "
                "app V6.")
            return

        # Mappa (verifica unicità: un utente = una chat)
        Link = self.env['erpv6.otp.bot.link'].sudo()
        # Rimuovi eventuali mapping precedenti per questo utente/chat
        Link.search(['|', ('user_id', '=', t.user_id.id),
                     ('chat_id', '=', chat_id)]).unlink()
        Link.create({
            'user_id': t.user_id.id,
            'chat_id': chat_id,
            'linked_at': fields.Datetime.now(),
        })
        t.write({'used': True, 'used_at': fields.Datetime.now()})

        _logger.info(
            'OTP bot: chat %s mappata a user %s',
            chat_id, t.user_id.name)
        self._send_otp_message(
            chat_id,
            "Ciao %s! Chat certificata. Ora riceverai qui i codici "
            "di accesso KB (V6 Auth)." % t.user_id.name)

    @api.model
    def generate_otp_deep_link(self, user, bot_username='v6auth_bot'):
        """Genera token monouso + deep link t.me/<bot>?start=<token>.
        Invalida i token precedenti dello stesso utente.
        Ritorna {token, deep_link, expires_at}."""
        import secrets as _secrets
        from datetime import timedelta as _td

        Token = self.env['erpv6.otp.bot.token'].sudo()
        # Invalida i token pendenti dello stesso utente
        Token.search([
            ('user_id', '=', user.id),
            ('used', '=', False),
        ]).write({'used': True, 'used_at': fields.Datetime.now()})

        token_value = _secrets.token_urlsafe(16)
        # 07/10/2026 (C-telegram-otp-bot-2): TTL 15 -> 30 min. Il master
        # ha tempo per i test manuali senza fretta. Token monouso,
        # sicurezza invariata.
        expires_at = fields.Datetime.now() + _td(minutes=30)
        Token.create({
            'user_id': user.id,
            'token': token_value,
            'expires_at': expires_at,
        })

        # 07/10/2026 (C-telegram-otp-bot-2): 3 varianti di link per
        # coprire tutti i canali senza attrito:
        #   - tg_link: protocollo nativo tg://, apre l'app (mobile
        #     e desktop) direttamente, no browser, no loop
        #   - web_link: Telegram Web per desktop senza app
        #   - manual_command: fallback universale (copia+incolla)
        tg_link = 'tg://resolve?domain=%s&start=%s' % (
            bot_username, token_value)
        web_link = 'https://t.me/%s?start=%s' % (
            bot_username, token_value)
        manual_command = '/start %s' % token_value

        return {
            'token': token_value,
            # Backward-compat: deep_link = web_link (link pubblico)
            'deep_link': web_link,
            # Nuovi campi
            'tg_link': tg_link,
            'tg_desktop_link': tg_link,
            'web_link': web_link,
            'manual_command': manual_command,
            'bot_username': bot_username,
            # qr_data = tg_link (per QR)
            'qr_data': tg_link,
            'expires_at': expires_at,
        }

    @api.model
    def get_otp_link_status(self, user):
        """Ritorna stato mappatura chat OTP dell'utente."""
        Link = self.env['erpv6.otp.bot.link'].sudo()
        link = Link.search([
            ('user_id', '=', user.id),
            ('revoked', '=', False),
        ], limit=1)
        if not link:
            return {'linked': False}
        # Masca chat_id: mostra solo ultime 4 cifre
        cid = link.chat_id or ''
        masked = ('*' * max(0, len(cid) - 4)) + cid[-4:]
        return {
            'linked': True,
            'chat_id_masked': masked,
            'linked_at': link.linked_at.isoformat() if link.linked_at else None,
        }

    @api.model
    def _cron_poll_otp_updates(self):
        """Polling dedicato SOLO per bot OTP (mode='otp').
        Isolato da _cron_poll_telegram_updates (id=80) che gestisce
        i bot operativi. Chiamato da cron ogni 10s con long polling
        timeout=10."""
        # Cleanup token scaduti da >1 giorno (evita accumulo)
        try:
            self.env['erpv6.otp.bot.token'].sudo()._cleanup_expired()
        except Exception:
            _logger.exception('OTP token cleanup fallito')

        configs = self.search([
            ('is_active', '=', True),
            ('bot_token', '!=', False),
            ('mode', '=', 'otp'),
        ])
        if not configs:
            return
        for config in configs:
            try:
                config._poll_updates_otp()
            except Exception:
                _logger.exception(
                    'Polling OTP fallito per configurazione %s',
                    config.name)

    def _poll_updates_otp(self):
        """Un giro di getUpdates con long polling timeout=10s per
        il bot OTP. Elabora ogni update tramite _process_otp_update."""
        self.ensure_one()
        if not self.bot_token:
            return
        token = self.get_decrypted_bot_token()
        if not token:
            return
        offset = self.last_update_id or 0
        try:
            response = requests.get(
                (TELEGRAM_API_BASE % token) + '/getUpdates',
                params={
                    'offset': offset + 1,
                    # Odoo non permette cron <1 min. Long polling
                    # timeout=50s: cron gira ogni 60s, aspetta 50s
                    # in ascolto, elabora. Latenza reale <1s per 83%
                    # del tempo (gap tra cron ~10s).
                    'timeout': 50,
                    'allowed_updates': '["message","edited_message"]',
                },
                timeout=60,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as e:
            _logger.error('OTP getUpdates fallito per %s: %s', self.name, e)
            return
        if not payload.get('ok'):
            _logger.error('OTP getUpdates non ok per %s: %s',
                          self.name, payload)
            return
        updates = payload.get('result') or []
        for u in updates:
            try:
                self._process_otp_update(u)
                upd_id = u.get('update_id')
                if upd_id:
                    self.last_update_id = max(self.last_update_id or 0, upd_id)
            except Exception:
                _logger.exception('OTP process update fallito: %s', u)

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
