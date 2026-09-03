from odoo import _
from odoo.exceptions import UserError

from odoo.addons.erpv6_core_dispatch.registry import register_process


def _run_neo4j_write_fix(env, node, input_data):
    """Motore ESTERNO (Denis, 29/08/2026, decomposizione erpv6_kaizen --
    spostato qui da erpv6_core_engine/models/core_node.py nel prompt #22):
    scrive DAVVERO un nodo Fix nel grafo Neo4j esterno. A differenza di
    send_to_documenso, e' SINCRONO -- Neo4j risponde nella stessa
    chiamata, nessun webhook/poll, nessuno stato 'in_attesa_esterna' qui
    (l'output non porta 'async': run_process lo tratta gia' come
    completamento immediato). Avvolge erpv6.kaizen.neo4j.client.
    write_fix_node(), non reimplementa la query Cypher -- se il nodo
    Code_Modello corrispondente non esiste nel grafo, il metodo reale non
    inventa un arco, lo segnala in 'edge_created'=False, propagato cosi'
    com'e'. Input: {'fix_id': str, 'sources': list, 'descrizione': str,
    'data': str, 'res_model': str}. Output: {'success', 'fix_id',
    'code_model_found', 'edge_created', 'code_model_id'}."""
    required = ('fix_id', 'sources', 'descrizione', 'data', 'res_model')
    missing = [k for k in required if not input_data.get(k)]
    if missing:
        raise UserError(_("Input mancante: %s.") % ', '.join(missing))
    result = env['erpv6.kaizen.neo4j.client'].write_fix_node(
        fix_id=input_data['fix_id'],
        sources=input_data['sources'],
        descrizione=input_data['descrizione'],
        data=input_data['data'],
        res_model=input_data['res_model'],
    )
    return {'success': True, **result}


def _run_kaizen_signal_to_context(env, node, input_data):
    """Motore IPO (Denis, 29/08/2026, decomposizione erpv6_kaizen --
    spostato qui da erpv6_core_engine/models/core_node.py nel prompt #22):
    il ponte mancante tra "il sensore ha rilevato qualcosa" (un PID
    'wrapped' non produce mai una nostra esecuzione a cui un Output-Link
    possa agganciarsi -- il cron reale gira fuori dal nostro sistema) e
    "l'AI deve ragionarci sopra con dati reali", trovato testando il nodo
    AIPO di Kaizen isolato: senza questo, genera un esempio inventato
    invece di dire 'nessun segnale reale fornito'. Legge un erpv6.kaizen.
    detected_signal REALE (mai un id indovinato) e lo trasforma in un
    contesto testuale -- se le 12 Regole sono gia' state valutate
    (rule_answer_ids), le include per intero, mai un riassunto. Input:
    {'detected_signal_id': int}. Output: {'success', 'context',
    'signal_id', 'rules_evaluated': bool}."""
    signal_id = input_data.get('detected_signal_id')
    if not signal_id:
        raise UserError(_("Input mancante: 'detected_signal_id' (erpv6.kaizen.detected_signal gia' esistente)."))
    signal = env['erpv6.kaizen.detected_signal'].browse(int(signal_id))
    if not signal.exists():
        raise UserError(_("Segnale #%s non trovato.") % signal_id)
    lines = [
        "Segnale Kaizen rilevato:",
        "- Chiave: %s" % signal.signal_key,
        "- Record monitorato: %s #%s" % (signal.res_model, signal.res_id),
        "- Origine: %s" % signal.origin,
        "- Rilevato il: %s" % signal.detected_at,
    ]
    rules_evaluated = bool(signal.rules_evaluated_at)
    if rules_evaluated:
        lines.append("\nValutazione delle 12 Regole (gia' completata il %s):" % signal.rules_evaluated_at)
        for answer in signal.rule_answer_ids.sorted('rule_number'):
            lines.append("- Regola %s (%s): %s" % (answer.rule_number, answer.rule_name, answer.answer_text))
    else:
        lines.append("\nLe 12 Regole non sono ancora state valutate per questo segnale.")
    return {
        'success': True, 'context': '\n'.join(lines),
        'signal_id': signal.id, 'rules_evaluated': rules_evaluated,
    }


register_process(
    'neo4j_write_fix',
    '[ESTERNO] Scrive nodo Fix su Neo4j (sincrono, MERGE reale)',
    'esterno', _run_neo4j_write_fix,
)
register_process(
    'kaizen_signal_to_context',
    '[IPO] Segnale Kaizen → contesto reale (ponte verso un nodo AIPO)',
    'ipo', _run_kaizen_signal_to_context,
)
