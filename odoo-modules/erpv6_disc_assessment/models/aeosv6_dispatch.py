import json

from odoo import _
from odoo.exceptions import UserError

from odoo.addons.erpv6_core_dispatch.registry import register_process

DISC_LETTERS = ('D', 'I', 'S', 'C')


def _run_disc_interview_score(env, node, input_data):
    """Motore IPO 'disc_interview_score' (Denis, 30/08/2026, prompt #21,
    primo Motore NATIVO -- non una conversione). Stesso principio di
    kb_engine_process (generico, la KB decide il contenuto -- domande,
    opzioni, quale lettera DISC vale ogni opzione), ma auto-contenuto qui:
    non chiama erpv6.kb.engine (quel dispatcher ha un elenco chiuso di
    kb_type che non include 'disc_assessment', ed estenderlo avrebbe
    voluto dire toccare erpv6_kb, fuori scope). Legge il contenuto della
    KB (rombo collegato al nodo) direttamente, con lo stesso principio
    anti-invenzione del resto del progetto: nessun default silenzioso,
    ogni domanda del banco deve avere una risposta valida o solleva
    errore esplicito.

    Input: {'answers': {'<question_id>': '<option_key>', ...}}. Output:
    {'success', 'disc': 'D'|'I'|'S'|'C', 'scores': {'D': int, 'I': int,
    'S': int, 'C': int}}.

    Scoring dichiarato esplicitamente (nessun algoritmo esistente trovato
    da riusare, verificato prima di scriverlo -- vedi report prompt #21):
    conteggio semplice di quante risposte cadono su ciascuna lettera,
    dominante = conteggio piu' alto, pareggio spezzato con ordine fisso
    D>I>S>C (scelta arbitraria dichiarata, non uno standard nascosto)."""
    answers = input_data.get('answers')
    if not isinstance(answers, dict) or not answers:
        raise UserError(_("Input mancante: 'answers' (dict non vuoto di risposte)."))

    if not node.kb_link_ids:
        raise UserError(_("Nodo '%s': nessun rombo KB collegato -- impossibile sapere quale banco domande usare.") % node.name)
    kb = node.kb_link_ids[0].resolve_kb()
    if not kb:
        raise UserError(_("Nodo '%s': il rombo KB collegato non risolve a nessuna voce erpv6.kb attiva.") % node.name)
    try:
        data = json.loads(kb.content) if kb.content else {}
    except (TypeError, ValueError):
        raise UserError(_("KB '%s': contenuto non e' JSON valido.") % kb.name)
    questions = data.get('questions') or []
    if not questions:
        raise UserError(_("KB '%s': nessuna domanda dichiarata (campo 'questions' vuoto o assente).") % kb.name)

    scores = {letter: 0 for letter in DISC_LETTERS}
    missing_questions = []
    invalid_answers = []
    for question in questions:
        qid = question.get('id')
        options = question.get('options') or {}
        if qid not in answers:
            missing_questions.append(qid)
            continue
        chosen = answers[qid]
        option = options.get(chosen)
        if not option or option.get('disc') not in DISC_LETTERS:
            invalid_answers.append('%s=%s' % (qid, chosen))
            continue
        scores[option['disc']] += 1

    if missing_questions:
        raise UserError(_(
            "Risposte mancanti per: %s -- tutte le domande del banco richiedono una risposta."
        ) % ', '.join(missing_questions))
    if invalid_answers:
        raise UserError(_(
            "Risposte non valide (opzione inesistente per quella domanda): %s."
        ) % ', '.join(invalid_answers))

    dominant = max(DISC_LETTERS, key=lambda letter: scores[letter])
    return {'success': True, 'disc': dominant, 'scores': scores}


register_process(
    'disc_interview_score',
    "[IPO] Calcola profilo DISC da risposte intervista (KB-driven, banco domande dichiarato)",
    'ipo', _run_disc_interview_score,
)
