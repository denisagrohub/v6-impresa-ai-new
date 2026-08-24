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
        history_text = "\n".join(
            "%s: %s" % ("Umano" if h.direction == 'in' else "Agente", h.text)
            for h in reversed(history)
        )
        Model.create({
            'agent_config_id': agent_config_id, 'chat_key': chat_key,
            'direction': 'in', 'text': incoming_text,
        })
        return history_text

    @classmethod
    def log_reply(cls, env, agent_config_id, chat_key, reply_text):
        env['erpv6.agent.chat.log'].sudo().create({
            'agent_config_id': agent_config_id, 'chat_key': chat_key,
            'direction': 'out', 'text': reply_text,
        })
