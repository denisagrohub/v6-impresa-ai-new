from odoo import fields, models

from .core_node import TIPO_DATO_VOCABOLARIO


class Erpv6CoreGateLog(models.Model):
    _name = 'erpv6.core.gate.log'
    _description = "Storico dei passaggi da un Gate, indicizzato per giro"

    # Denis, 30/08/2026, prompt #11 -- SOLO SCHEMA. Nessuna riga scritta da
    # nessun punto del codice esistente in questo prompt: run_process(),
    # run_circuit(), la morsettiera (prompt #6) restano bit-per-bit
    # invariati. Il ciclo di vita lavoro/storico (§I.4 dell'addendum) e' qui
    # solo un campo (conserva_storico) -- il comportamento di pulizia
    # automatica NON e' implementato, resta per un prompt successivo.
    giro_id = fields.Char(required=True, index=True)
    gate_id = fields.Many2one(
        'erpv6.core.node', required=True,
        help="Il nodo Gate (phase_gate_type valorizzato) o il nodo la cui morsettiera ha girato.")
    esito = fields.Selection(
        [('passato', 'Passato'), ('bloccato', 'Bloccato'), ('in_attesa', 'In attesa')],
        required=True)
    timestamp = fields.Datetime(default=fields.Datetime.now, required=True)
    input_snapshot = fields.Json(
        help="Valori in morsettiera al momento del passaggio. Documenti: mai contenuto grezzo, "
             "solo id Libreria (vedi §I.5 addendum) -- non applicabile ancora in questo prompt, "
             "zero scrittura reale qui.")
    tipo_dato = fields.Selection(
        TIPO_DATO_VOCABOLARIO,
        help="Se il log riguarda un dato tipizzato, quale tipo -- riusa il vocabolario "
             "esistente, non inventarne uno nuovo.")
    conserva_storico = fields.Boolean(
        default=False,
        help="False (default) = riga di lavoro, eliminabile a fine giro. True = sopravvive al "
             "giro, sola lettura per audit (vedi §I.4 addendum). Nessun meccanismo di pulizia "
             "automatica implementato qui -- solo il campo.")
