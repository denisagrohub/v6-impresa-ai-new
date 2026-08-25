from odoo import fields, models

CHAT_HISTORY_LIMIT = 10


class Erpv6AgentChatLog(models.Model):
    """Storico REALE delle conversazioni Telegram di ogni agente (24/08/2026,
    richiesto esplicitamente da Denis: "le chat dovrebbero essere salvate,
    uno l'agente ha memoria della comunicazione, due si possono imparare
    errori" - notando che Susanna a volte risponde in modo difficile da
    capire rispetto alla domanda fatta).

    Discuss NON ha bisogno di questo modello: i messaggi restano gia'
    persistiti nativamente da Odoo (mail.message sul canale), consultabili
    aprendo il canale. Questo modello copre SOLO Telegram, dove oggi ogni
    scambio veniva perso subito dopo la risposta (thread_history sempre
    vuoto in answer_conversationally, limite gia' documentato)."""
    _name = 'erpv6.agent.chat.log'
    _description = 'Storico conversazione Telegram con un agente'
    _order = 'create_date asc'

    agent_config_id = fields.Many2one('erpv6.agent.config', required=True, ondelete='cascade', index=True)
    chat_key = fields.Char(
        required=True, index=True,
        help="Identifica LA conversazione (es. chat_id Telegram) - per ricostruire lo storico "
             "solo di quella, non di tutte insieme.")
    direction = fields.Selection([
        ('in', 'Umano → Agente'),
        ('out', 'Agente → Umano'),
    ], required=True)
    text = fields.Text(required=True)
    telegram_message_id = fields.Integer(
        string='ID Messaggio Telegram', index=True,
        help="message_id nativo Telegram del messaggio 'out' che l'agente ha davvero inviato "
             "(valorizzato da agent_telegram_config.py.send_message al momento dell'invio, MAI "
             "su un messaggio 'in'). Aggiunto il 25/08/2026 per la feature 'reazione 👎': senza "
             "questo id non c'e' modo di risalire dal message_id di un update Telegram "
             "'message_reaction' (che contiene SOLO chat+message_id, mai il testo) al record "
             "storico giusto -- vedi find_by_telegram_message_id sotto. Vuoto sui messaggi 'in' "
             "e su qualunque 'out' inviato PRIMA di questa modifica (storico non retroattivo: "
             "una reazione su un messaggio vecchio non trova corrispondenza, gestito esplicitamente "
             "in agent_telegram_config.py._process_reaction_update, mai un errore silenzioso).")

    # Azione proposta (25/08/2026, richiesto esplicitamente da Denis dopo
    # aver scoperto che Susanna diceva "ho inoltrato/trasmesso" senza
    # scrivere MAI nulla di reale per una richiesta libera senza un
    # meccanismo gia' collegato: "dobbiamo far si' che tutte le azioni
    # siano azioni reali a codice, non che siano azioni che fa la AI,
    # altrimenti si perde il controllo e Susanna inventa"). Popolati SOLO
    # su un messaggio 'out': l'AI puo' PROPORRE un'azione qui (dati inerti,
    # mai eseguiti da lei), ma solo la parola chiave chiusa 'registra'
    # (vedi agent_telegram_config.py) la trasforma in un record reale -
    # stesso principio del gate umano gia' seguito ovunque.
    pending_action_type = fields.Selection([
        ('claudio', 'Proposta per Claudio (task di codice preciso)'),
        ('alessandro', 'Proposta per Alessandro (indagine/task ambiguo)'),
        ('kaizen_signal', 'Segnalazione Kaizen (miglioramento/idea)'),
    ], help="Vuoto = nessuna azione concreta proposta in questo messaggio.")
    pending_action_title = fields.Char()
    pending_action_description = fields.Text()
    pending_action_consumed = fields.Boolean(
        default=False, copy=False,
        help="Vero dopo che 'registra' ha davvero creato il record collegato - "
             "evita di ricrearlo due volte se Denis scrive 'registra' più di una volta.")

    @classmethod
    def find_pending_action(cls, env, agent_config_id, chat_key):
        """L'ultima azione proposta non ancora consumata su questa
        conversazione - None se non ce n'e' nessuna (mai indovinare a
        quale messaggio Denis si riferisce se il tempo e' passato: solo
        l'ultima, come una coda a un solo elemento)."""
        return env['erpv6.agent.chat.log'].sudo().search([
            ('agent_config_id', '=', agent_config_id), ('chat_key', '=', chat_key),
            ('direction', '=', 'out'), ('pending_action_type', '!=', False),
            ('pending_action_consumed', '=', False),
        ], limit=1, order='create_date desc')

    @classmethod
    def _format_history(cls, records):
        """Formattazione condivisa 'Umano: ...'/'Agente: ...' -- fattorizzata
        il 25/08/2026 (feature reazione 👎) da dentro log_and_get_history,
        perche' get_history_text (sotto, usato per rileggere il contesto
        attorno a un messaggio segnalato) ha bisogno DELLA STESSA identica
        formattazione, mai una seconda versione che potrebbe disallinearsi."""
        return "\n".join(
            "%s: %s" % ("Umano" if h.direction == 'in' else "Agente", h.text)
            for h in reversed(records)
        )

    @classmethod
    def get_history_text(cls, env, agent_config_id, chat_key, limit=CHAT_HISTORY_LIMIT):
        """Storico formattato SENZA registrare nulla di nuovo -- a differenza
        di log_and_get_history (che registra sempre un 'in' in ingresso),
        questo serve quando non c'e' nessun nuovo messaggio testuale umano
        da salvare (es. una reazione 👎 su un messaggio esistente, vedi
        agent_telegram_config.py._process_reaction_update): serve SOLO
        rileggere il contesto gia' persistito, mai crearne di nuovo."""
        Model = env['erpv6.agent.chat.log'].sudo()
        history = Model.search([
            ('agent_config_id', '=', agent_config_id), ('chat_key', '=', chat_key),
        ], limit=limit, order='create_date desc')
        return cls._format_history(history)

    @classmethod
    def find_by_telegram_message_id(cls, env, agent_config_id, chat_key, telegram_message_id):
        """Risale dal message_id nativo Telegram (l'UNICO dato che un update
        'message_reaction' porta con se', vedi MessageReactionUpdated: chat
        + message_id, MAI il testo) al record storico 'out' che l'agente ha
        davvero scritto -- None se non trovato (messaggio precedente
        all'introduzione di telegram_message_id, o reazione su un messaggio
        di un'altra chat/agente: mai indovinare un match approssimato)."""
        return env['erpv6.agent.chat.log'].sudo().search([
            ('agent_config_id', '=', agent_config_id), ('chat_key', '=', chat_key),
            ('direction', '=', 'out'), ('telegram_message_id', '=', telegram_message_id),
        ], limit=1)

    @classmethod
    def log_and_get_history(cls, env, agent_config_id, chat_key, incoming_text):
        """Registra il messaggio in ingresso e ritorna lo storico
        formattato (esclude quello appena scritto, che va passato come
        question_text separatamente a answer_conversationally) - un solo
        punto per non disallineare mai 'quello che si salva' da 'quello
        che si rilegge'."""
        Model = env['erpv6.agent.chat.log'].sudo()
        history = Model.search([
            ('agent_config_id', '=', agent_config_id), ('chat_key', '=', chat_key),
        ], limit=CHAT_HISTORY_LIMIT, order='create_date desc')
        history_text = cls._format_history(history)
        Model.create({
            'agent_config_id': agent_config_id, 'chat_key': chat_key,
            'direction': 'in', 'text': incoming_text,
        })
        return history_text

    @classmethod
    def log_reply(cls, env, agent_config_id, chat_key, reply_text, pending_action=None):
        """pending_action (opzionale): dict {'type','title','description'}
        proposto dall'AI in questa risposta - salvato inerte, mai eseguito
        qui (vedi find_pending_action/pending_action_consumed)."""
        vals = {
            'agent_config_id': agent_config_id, 'chat_key': chat_key,
            'direction': 'out', 'text': reply_text,
        }
        if pending_action and pending_action.get('type'):
            vals['pending_action_type'] = pending_action['type']
            vals['pending_action_title'] = pending_action.get('title') or ''
            vals['pending_action_description'] = pending_action.get('description') or ''
        return env['erpv6.agent.chat.log'].sudo().create(vals)
