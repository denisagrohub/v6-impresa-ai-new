from odoo import fields, models


class Erpv6KaizenRuleAnswer(models.Model):
    """Tabella TEMPORANEA per segnale, richiesta esplicitamente da Denis dopo
    un caso reale documentato in docs/KAIZEN_rule_application_worked_example.md:
    applicando le 12 Regole in conversazione, un'analisi gia' fatta (il
    risultato della Regola 1) e' stata persa prima di arrivare alla sintesi
    finale, recuperata solo perche' l'utente se n'e' accorto. Kaizen NON puo'
    tenere il ragionamento "in memoria di conversazione": ogni regola
    applicata a un segnale scrive qui la propria risposta (una riga per
    numero_regola + risposta + dati a supporto), e la Regola 11 (scoring)
    deve RILEGGERE queste righe invece di fidarsi del contesto implicito --
    vedi erpv6.kaizen.detected_signal.evaluate_12_rules() in
    kaizen_rule_engine.py, che scrive qui ad ogni regola applicata."""
    _name = 'erpv6.kaizen.rule.answer'
    _description = "Risposta di Kaizen a una delle 12 Regole, per segnale"
    _order = 'signal_id, rule_number'

    signal_id = fields.Many2one(
        'erpv6.kaizen.detected_signal', string='Segnale', required=True,
        ondelete='cascade', index=True)
    rule_number = fields.Integer(
        string='Regola (0-11)', required=True,
        help="0-11, stesso numero della voce KB corrispondente in categoria 'Regole Kaizen'.")
    rule_name = fields.Char(
        string='Nome Regola',
        help="Copiato dal nome della voce KB al momento della risposta -- la 'conoscenza' (testo "
             "della regola) resta nella KB, questo campo e' solo per leggibilita' della riga.")
    answer_text = fields.Text(
        string='Risposta', required=True,
        help="Risposta esplicita, anche quando la regola non si applica al caso (in quel caso il "
             "testo deve dire 'non applicabile qui, motivo: ...') -- mai una riga saltata/vuota.")
    supporting_data = fields.Json(string='Dati a Supporto')
    verified_live = fields.Boolean(
        string='Verificato dal vivo',
        help="True solo se questa risposta si basa su una query/verifica eseguita ORA (Regola 4, e "
             "la parte di Regola 11 che interroga il grafo per l'Indicatore 5) -- non su un dato "
             "riusato da un giro/turno precedente senza riverifica.")

    _sql_constraints = [
        ('uniq_signal_rule', 'UNIQUE(signal_id, rule_number)',
         "Questa regola e' gia' stata risposta per questo segnale -- per rivalutare, cancellare "
         "prima le righe esistenti (vedi evaluate_12_rules(force=True)), mai duplicarle."),
    ]
