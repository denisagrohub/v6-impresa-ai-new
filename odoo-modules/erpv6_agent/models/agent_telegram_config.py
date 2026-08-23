import json
import logging

import requests

from odoo import _, api, fields, models
from odoo.tools import html2plaintext

_logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = 'https://api.telegram.org/bot%s'
TELEGRAM_HTTP_TIMEOUT = 15


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

    def send_message(self, text):
        """Invia un messaggio di testo alla chat configurata (sendMessage).
        Ritorna True/False -- non solleva mai un'eccezione al chiamante
        (stesso principio gia' seguito ovunque per i canali di notifica: un
        canale che fallisce non deve mai far fallire l'intero flusso che lo
        chiama), logga per intero l'errore reale."""
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
            response = requests.post(
                (TELEGRAM_API_BASE % token) + '/sendMessage',
                json={'chat_id': self.chat_id, 'text': text},
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
    def send_message_for_agent(self, agent_config, text):
        """Punto di ingresso usato dal resto del sistema (es.
        erpv6.agent.confirmation._escalate, Compito 3): invia via Telegram
        SOLO se esiste una configurazione attiva collegata a quell'agente
        -- silenzioso (nessuna eccezione, nessun log di errore, solo debug)
        se non esiste, perche' e' il caso normale oggi (nessun token reale
        ancora fornito). Chiamare sempre dentro un try/except lato
        chiamante comunque, per difesa in profondita'."""
        config = self.search([
            ('agent_config_id', '=', agent_config.id), ('is_active', '=', True), ('bot_token', '!=', False),
        ], limit=1)
        if not config:
            return False
        return config.send_message(text)

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

    def _process_update(self, update):
        """UN update in ingresso: solo messaggi testuali dalla chat_id
        configurata vengono elaborati (nessun'altra chat, nessun contenuto
        non testuale -- foto/documenti/sticker restano fuori perimetro).
        Genera sempre e solo una risposta conversazionale via
        agent_config_id.answer_conversationally, MAI un'azione: stesso
        vincolo non negoziabile gia' applicato ai canali Discuss."""
        self.ensure_one()
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
        answer = self.agent_config_id.answer_conversationally(
            title=_("Telegram — %s") % self.agent_config_id.name,
            thread_history='',  # Compito 6: nessuno storico multi-turno persistito per Telegram
                                 # ancora (limite noto, vedi report finale) -- ogni messaggio e'
                                 # risposto indipendentemente, come un primo turno.
            question_text=text,
        )
        self.send_message(answer)

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
