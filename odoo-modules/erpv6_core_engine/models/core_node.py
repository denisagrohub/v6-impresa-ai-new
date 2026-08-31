import ast
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

# Denis, 30/08/2026: vocabolario unico condiviso tra rombo KB (data_format),
# Nodo (input_format) e Output (output_type) -- prima erano tre elenchi
# paralleli (kb_link/node in inglese 'text', output gia' in italiano
# 'testo'), un mismatch reale che impediva a un Output di agganciarsi come
# input di un altro Motore per TIPO, non solo per presenza. Stesso pattern
# di SAFE_PROCESSES/SAFE_ACTIVATION_TRIGGERS sotto: una sola definizione,
# riusata ovunque -- kb_link.py, core_output.py, core_output_link.py e il
# controller la importano da qui, mai un elenco proprio.
TIPO_DATO_VOCABOLARIO = [
    ('testo', 'Testo'),
    ('json', 'JSON'),
    ('prompt', 'Prompt/Template'),
    ('documento', 'Documento'),
    ('tabella', 'Tabella (elenco/matrice)'),
]

# Elenco CHIUSO dei trigger che un Cron di ruolo 'attivazione' puo' invocare
# (Denis, 29/08/2026: creare Cron veri da UI, ma mai con un nome di metodo
# libero scritto in un form -- solo questi due, gia' verificati sicuri in
# questa stessa sessione). 'model': chiamata @api.model senza dominio/
# recordset (il metodo fa la propria ricerca interna, es. il retry
# tecnico). 'recordset': cerca cron_domain su 'model' e chiama il metodo
# sul recordset trovato (es. avanzamento produzione, un ordine alla volta).
SAFE_ACTIVATION_TRIGGERS = {
    'validation_retry_ai_failure': {
        'label': 'Retry validazione (fallimento tecnico AI)',
        'model': 'erpv6.validation.session',
        'method': '_cron_retry_escalated_ai_failures',
        'call_style': 'model',
    },
    'production_evaluate_advance': {
        'label': 'Avanza produzione a fasi',
        'model': 'erpv6.production.order',
        'method': 'evaluate_and_advance',
        'call_style': 'recordset',
    },
}


def _run_generate_phase_document(env, node, input_data):
    """Motore IPO 'generate_phase_document' (Denis, 29/08/2026: nodo con
    Input/Processo/Output reale, esempio Typst). NON reimplementa la
    generazione -- chiama order._generate_phase_output(phase), gia'
    esistente e verificata in erpv6_production/models/production_order.py.
    Input: {'order_id': int, 'phase_xmlid': str opzionale (default:
    order.phase_id)}. Output: {'success', 'document_id', 'document_name'} +
    passthrough implicito dell'input ricevuto."""
    order_id = input_data.get('order_id')
    if not order_id:
        raise UserError(_("Input mancante: order_id (erpv6.production.order)."))
    order = env['erpv6.production.order'].browse(int(order_id))
    if not order.exists():
        raise UserError(_("Produzione #%s non trovata.") % order_id)
    phase_xmlid = input_data.get('phase_xmlid')
    phase = env.ref(phase_xmlid, raise_if_not_found=False) if phase_xmlid else order.phase_id
    if not phase or not phase.exists():
        raise UserError(_("Fase non trovata (order.phase_id vuoto e nessun phase_xmlid valido passato)."))
    result = order._generate_phase_output(phase)
    output = {'passthrough': input_data, 'success': bool(result)}
    if result:
        output['document_id'] = result.id
        output['document_name'] = result.name
    return output


def _run_ai_analyze(env, node, input_data):
    """Motore IPO INTELLIGENTE (Denis, 29/08/2026): chiama erpv6_omni_bridge
    direttamente -- stesso layer AI usato da erpv6_validation, ma percorso
    PARALLELO e indipendente, per verificare che IPO generalizza anche ai
    processi intelligenti (non solo deterministici come Typst) senza
    toccare il circuito 6 Giudici esistente. Input: {'task_type':
    'validation_analyst'|'validation_sesto_uomo', 'prompt': str}. Output:
    {'success', 'raw_response'} + passthrough implicito."""
    task_type = input_data.get('task_type') or 'validation_analyst'
    prompt = input_data.get('prompt')
    # Nessun prompt esplicito passato: risolve dal rombo KB del nodo, se
    # c'e' -- serve per far girare un intero circuito senza dover scrivere
    # a mano il prompt di ciascun nodo (Denis, 29/08/2026: "Esegui Circuito").
    # 'node' arriva da run_process, MAI dentro input_data (che finisce in
    # un campo Json, un recordset Odoo non e' serializzabile li' dentro).
    if not prompt and node is not None and node.kb_link_ids:
        kb = node.kb_link_ids[0].resolve_kb()
        if kb:
            prompt = kb.content
    if not prompt:
        raise UserError(_("Input mancante: 'prompt' (e nessun rombo KB collegato da cui risolverlo)."))
    # Se il nodo riceve output da nodi a monte (run_process li ha gia'
    # assemblati in input_data['upstream_outputs']), li incorpora davvero
    # nel prompt -- un Arbitro deve poter ragionare su cosa hanno prodotto
    # gli Analisti a monte, non solo eseguire il proprio prompt isolato.
    upstream = input_data.get('upstream_outputs')
    if upstream:
        findings = '\n'.join(
            "- %s: %s" % (u['source_node'], (u['output'] or {}).get('raw_response', u['output']))
            for u in upstream
        )
        prompt = "%s\n\nAnalisi ricevute dai nodi a monte:\n%s" % (prompt, findings)
    result = env['erpv6.omni.bridge'].execute_ai_task(task_type=task_type, prompt=prompt)
    output = {'passthrough': input_data, 'success': bool(result.get('success'))}
    if not result.get('success'):
        output['error'] = result.get('error') or 'chiamata AI fallita (nessun dettaglio)'
        return output
    try:
        output['raw_response'] = result['data']['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError):
        output['success'] = False
        output['error'] = 'risposta AI in formato inatteso (non una chat completion standard)'
    return output


def _run_send_to_documenso(env, node, input_data):
    """Motore ESTERNO (Denis, 29/08/2026, decomposizione erpv6_contract/
    erpv6_sign): invia DAVVERO una richiesta di firma a Documenso -- un
    servizio terzo fuori dal sistema, non un calcolo interno (IPO) ne' una
    chiamata AI (AIPO). Effetto reale: spedisce un'email vera al
    firmatario. A differenza di IPO/AIPO, la chiamata che 'esegue' questo
    Motore NON produce il risultato finale -- l'invio e' solo l'inizio, il
    completamento vero (firma) arriva dopo via webhook o poll (vedi
    sign_request_ext.py, che chiude questa esecuzione quando arriva
    davvero). Input: {'sign_request_id': int} -- la richiesta deve gia'
    esistere (creata dal flusso normale erpv6_sign/erpv6_contract), questo
    Motore non la inventa e non decide da solo chi firma cosa."""
    sign_request_id = input_data.get('sign_request_id')
    if not sign_request_id:
        raise UserError(_("Input mancante: 'sign_request_id' (erpv6.sign.request gia' esistente)."))
    sign_request = env['erpv6.sign.request'].browse(int(sign_request_id))
    if not sign_request.exists():
        raise UserError(_("Richiesta di firma #%s non trovata.") % sign_request_id)
    if sign_request.status != 'draft':
        raise UserError(_(
            "Richiesta di firma #%s non e' in bozza (status='%s') -- gia' inviata o oltre, "
            "non la reinvio."
        ) % (sign_request_id, sign_request.status))
    sign_request.action_send_to_sign()
    return {
        'success': True, 'async': True, 'sign_request_id': sign_request.id,
        'external_id': sign_request.external_id, 'request_url': sign_request.request_url,
    }


def _run_neo4j_write_fix(env, node, input_data):
    """Motore ESTERNO (Denis, 29/08/2026, decomposizione erpv6_kaizen):
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
    """Motore IPO (Denis, 29/08/2026, decomposizione erpv6_kaizen): il
    ponte mancante tra "il sensore ha rilevato qualcosa" (un PID 'wrapped'
    non produce mai una nostra esecuzione a cui un Output-Link possa
    agganciarsi -- il cron reale gira fuori dal nostro sistema) e "l'AI
    deve ragionarci sopra con dati reali", trovato testando il nodo AIPO
    di Kaizen isolato: senza questo, genera un esempio inventato invece
    di dire 'nessun segnale reale fornito'. Legge un erpv6.kaizen.
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


def _run_crea_lead(env, node, input_data):
    """Motore IPO 'crea record' (Denis, 30/08/2026, decomposizione Circuito
    Acquisizione v6impresa): Fase 1 isolata da tutto il resto -- il
    controller reale (erpv6_api_gateway/lead_api.py:create_lead) fa GIA'
    cinque azioni in una chiamata (crea lead, promuove a opportunity, avvia
    funnel, avvia produzione, webhook): questo Motore ne isola
    DELIBERATAMENTE solo la prima, "un motore fa una e una sola azione"
    (Denis, 30/08/2026). Le altre quattro azioni diventano nodi separati a
    valle nel circuito, non replicate qui. Nasce sempre type='lead' (mai
    'opportunity' -- quella e' una transizione di Fase 2, non di questo
    Motore). Input: {'name': str, 'email': str, 'company_name': str
    opzionale, 'phone': str opzionale}. Output: {'success', 'lead_id',
    'lead_name'}."""
    name = (input_data.get('name') or '').strip()
    email = (input_data.get('email') or '').strip()
    if not name or not email:
        raise UserError(_("Input mancante: 'name' e 'email' sono obbligatori."))
    company = (input_data.get('company_name') or '').strip()
    lead_name = _("Lead Web: %s") % name
    if company:
        lead_name = "%s - %s" % (lead_name, company)
    lead = env['crm.lead'].sudo().create({
        'name': lead_name,
        'contact_name': name,
        'partner_name': company,
        'email_from': email,
        'phone': input_data.get('phone') or '',
        'type': 'lead',
    })
    return {'success': True, 'lead_id': lead.id, 'lead_name': lead.name}


def _run_create_tracking_lot(env, node, input_data):
    """Motore IPO (Denis, 29/08/2026, decomposizione erpv6_tracking): crea
    DAVVERO un lotto di tracciamento -- non reimplementa la logica di
    codice, avvolge erpv6.tracking.lot.create_batch_lot()/
    create_definitive_lot(), che ora leggono la sigla azienda da
    res.company.company_code (vedi tracking_lot._get_company_code) e
    sollevano errore esplicito se manca, invece di generare un codice con
    un buco silenzioso. Input: {'lot_type': 'batch'|'definitive',
    'config_id': int, 'quantity': float opzionale, 'batch_lot_id': int
    opzionale (solo per 'definitive'), 'notes': str opzionale}. Output:
    {'success', 'lot_id', 'code', 'lot_type'}."""
    lot_type = input_data.get('lot_type')
    if lot_type not in ('batch', 'definitive'):
        raise UserError(_("Input mancante o non valido: 'lot_type' deve essere 'batch' o 'definitive'."))
    config_id = input_data.get('config_id')
    if not config_id:
        raise UserError(_("Input mancante: 'config_id' (erpv6.tracking.config gia' esistente)."))
    config = env['erpv6.tracking.config'].browse(int(config_id))
    if not config.exists():
        raise UserError(_("Configurazione tracciamento #%s non trovata.") % config_id)

    Lot = env['erpv6.tracking.lot']
    quantity = input_data.get('quantity', 1.0)
    notes = input_data.get('notes')
    if lot_type == 'batch':
        lot = Lot.create_batch_lot(config_id=config.id, quantity=quantity, notes=notes)
    else:
        batch_lot_id = input_data.get('batch_lot_id')
        lot = Lot.create_definitive_lot(
            config_id=config.id,
            batch_lot_id=int(batch_lot_id) if batch_lot_id else None,
            quantity=quantity, notes=notes,
        )
    return {'success': True, 'lot_id': lot.id, 'code': lot.code, 'lot_type': lot_type}


# Denis, 29/08/2026: i 13 valori legacy di erpv6.library.document.category
# (Selection chiusa, mai toccata -- vedi core_library_category.py). Un'
# etichetta dichiarata da un circuito che coincide con uno di questi passa
# diretta; altrimenti 'other' per il campo legacy (che resta required=True),
# mentre l'etichetta precisa vive comunque in category_id (vero record).
LIBRARY_LEGACY_CATEGORY_VALUES = {
    'nda', 'proposal', 'sal', 'contract', 'business_plan', 'final', 'client_upload',
    'other', 'brand_logo', 'brand_asset', 'kb_source', 'kb_case_study', 'agent_knowledge',
}


def _run_label_output(env, node, input_data):
    """Motore IPO 'etichettatrice' (Denis, 29/08/2026): legge/CONFERMA
    l'etichetta di un Output -- non cerca/crea piu' la categoria lui
    stesso, la trova gia' risolta (category_id), perche' erpv6.core.
    output.create() ora la trova-o-crea nel momento stesso in cui l'Output
    viene dichiarato (in un data XML all'installazione del circuito, o via
    API) -- 'nel momento in cui si installa un circuito nuovo, il
    catalogo legge anche gli output e se non esistono li crea'. Questo
    Motore resta il punto che un circuito chiama per confermare
    esplicitamente l'etichettatura di un Output specifico prima di
    passarlo al Traslo. Input: {'output_id': int}. Output: {'success',
    'category_id', 'category_name'}."""
    output_id = input_data.get('output_id')
    if not output_id:
        raise UserError(_("Input mancante: 'output_id' (erpv6.core.output gia' dichiarato)."))
    output = env['erpv6.core.output'].browse(int(output_id))
    if not output.exists():
        raise UserError(_("Output #%s non trovato.") % output_id)
    if not output.category_id:
        # Non dovrebbe mai succedere (create() la risolve sempre se
        # library_category_name e' valorizzato, required=True sul campo) --
        # ma se capita, errore esplicito, mai un'invenzione qui.
        raise UserError(_(
            "Output #%s ('%s'): categoria non risolta -- verificare library_category_name."
        ) % (output.id, output.name))
    return {'success': True, 'category_id': output.category_id.id, 'category_name': output.category_id.name}


def _run_file_to_library(env, node, input_data):
    """Motore IPO (Denis, 29/08/2026, decomposizione erpv6_library: "un
    motore che etichetta e organizza gli output che tutto erpv6 crea").
    Avvolge erpv6.library.document.register_document(), il punto di
    ingresso canonico GIA' esistente -- non lo reimplementa. La scoperta
    che l'ha motivato: alcuni percorsi (erpv6_api_gateway, erpv6_marketing)
    bypassano register_document() con una create() diretta, saltando la
    certificazione blockchain automatica -- ogni circuito nuovo che passa
    da QUESTO Motore non puo' piu' bypassarlo per costruzione.

    Input: {'project_id': int, 'name': str, 'origin': str, 'category': str
    opzionale (se assente, risolto dall'etichettatrice via un Output
    collegato -- vedi sotto), 'is_final': bool opzionale, 'source_model'/
    'source_res_id' opzionali, 'file_data'/'file_name' opzionali}. Se il
    contenuto del file non e' passato esplicitamente, lo risolve dal primo
    Output collegato (output_link_ids, gia' assemblato da run_process in
    input_data['linked_outputs']) -- cosi' il documento generato da un
    Motore a monte (es. generate_phase_document) si archivia qui senza
    dover ricopiare a mano i byte. Stesso principio per 'category': se non
    passata esplicita, cerca tra i linked_outputs il risultato di un
    Motore etichettatrice (label_output, riconosciuto da 'category_name')
    -- il valore legacy Selection e' quello se coincide con uno dei 13
    noti, altrimenti 'other' (il campo legacy resta required), mentre
    l'etichetta precisa va comunque su category_id (vero record). Output:
    {'success', 'document_id', 'name'}."""
    required = ('project_id', 'name', 'origin')
    missing = [k for k in required if not input_data.get(k)]
    if missing:
        raise UserError(_("Input mancante: %s.") % ', '.join(missing))

    file_data = input_data.get('file_data')
    file_name = input_data.get('file_name')
    category_id = None
    category = input_data.get('category')
    for linked in (input_data.get('linked_outputs') or []):
        value = linked.get('value') or {}
        if not file_data and (value.get('file_data') or value.get('content')):
            file_data = value.get('file_data') or value.get('content')
            file_name = file_name or value.get('file_name')
        if not category and value.get('category_name'):
            category_name = value['category_name']
            category = category_name if category_name in LIBRARY_LEGACY_CATEGORY_VALUES else 'other'
            category_id = value.get('category_id')
    if not category:
        raise UserError(_(
            "Input mancante: 'category' (ne' passata esplicita, ne' risolta da un Output "
            "collegato con etichetta -- vedi Motore label_output)."
        ))

    document = env['erpv6.library.document'].register_document(
        project_id=int(input_data['project_id']),
        name=input_data['name'],
        category=category,
        origin=input_data['origin'],
        source_model=input_data.get('source_model'),
        source_res_id=input_data.get('source_res_id'),
        file_data=file_data,
        file_name=file_name,
        is_final=bool(input_data.get('is_final')),
    )
    if category_id:
        document.write({'category_id': int(category_id)})
    return {'success': True, 'document_id': document.id, 'name': document.name}


# Denis, 29/08/2026: "il motore per principio trasforma un'entrata in
# qualcosa di diverso -- se passa il grezzo deve dare un errore dicendo
# cosa manca, non fingere successo". erpv6.kb.engine._process_kb ha un
# ramo dedicato SOLO per questi kb_type (vedi dict 'processors' in
# erpv6_kb/models/kb_engine.py) -- per qualunque altro tipo cade nel ramo
# generico _process_default, che ritorna il contenuto grezzo della KB
# senza elaborarlo: non e' una vera trasformazione, quindi va trattato
# come errore, non come successo apparente.
KB_ENGINE_SPECIALIZED_TYPES = {'colori', 'psicologia', 'metodi', 'regole', 'storytelling', 'commerciale'}

# Denis, 29/08/2026: "il motore funziona solo se ha tutte le entrate, se
# non le ha come puo' funzionare" -- ogni _process_<tipo> in erpv6_kb ha
# pero' dei default hardcoded (es. 'C', 'professionisti') che sostituiscono
# in silenzio un input mancante, quindi senza questo elenco il Motore
# "funzionerebbe" comunque, solo con dati inventati da erpv6_kb invece che
# forniti da chi lo chiama -- stesso principio del controllo su output
# vuoto sopra, qui applicato all'input.
KB_ENGINE_REQUIRED_INPUTS = {
    'colori': ('disc', 'target'),
    'psicologia': ('disc',),
    'metodi': ('method_type',),
    'regole': (),
    'storytelling': ('disc', 'company'),
    'commerciale': (),
}


def _run_kb_engine_process(env, node, input_data):
    """Motore IPO GENERICO (Denis, 29/08/2026, decomposizione erpv6_color):
    avvolge erpv6.kb.engine.process(), gia' un piccolo motore generico che
    smista internamente su kb.kb_type (colori/psicologia/metodi/regole/
    storytelling/commerciale/default) -- un solo process_key qui copre
    tutti i tipi, invece di uno stretto per ciascuno (es. 'genera palette').
    Cosa fa DAVVERO questo nodo lo decide solo il rombo KB collegato
    (kb_type_dynamic), zero codice specifico qui. Input: qualunque dict
    (es. {'disc': 'C', 'target': 'professionisti', 'sector': '...'} per il
    caso colori) -- passato cosi' com'e' a kb.engine.process(). Output:
    {'success', 'kb_id', 'kb_name', 'result'}."""
    if not node.kb_link_ids:
        raise UserError(_("Nodo '%s': nessun rombo KB collegato -- impossibile sapere quale KB usare.") % node.name)
    kb = node.kb_link_ids[0].resolve_kb()
    if not kb:
        raise UserError(_(
            "Nodo '%s': il rombo KB collegato non risolve a nessuna voce erpv6.kb attiva."
        ) % node.name)
    if kb.kb_type not in KB_ENGINE_SPECIALIZED_TYPES:
        raise UserError(_(
            "Nodo '%s': la KB '%s' ha kb_type='%s', ma erpv6.kb.engine non ha un traduttore "
            "dedicato per questo tipo (solo %s) -- ritornerebbe il contenuto grezzo della KB "
            "senza elaborarlo, non e' una vera trasformazione. Serve implementare un "
            "_process_<tipo> in erpv6_kb, oppure usare un altro Motore per questo nodo."
        ) % (node.name, kb.name, kb.kb_type, ', '.join(sorted(KB_ENGINE_SPECIALIZED_TYPES))))
    payload = {k: v for k, v in input_data.items() if k != 'upstream_outputs'}
    missing_inputs = [k for k in KB_ENGINE_REQUIRED_INPUTS.get(kb.kb_type, ()) if not payload.get(k)]
    if missing_inputs:
        raise UserError(_(
            "Nodo '%s': input mancante per kb_type='%s': %s -- il Motore non usa default "
            "impliciti, vanno forniti esplicitamente."
        ) % (node.name, kb.kb_type, ', '.join(missing_inputs)))
    result = env['erpv6.kb.engine'].process(kb.id, payload)
    # Denis, 29/08/2026: "il caso palette vuota va alzato a errore visibile,
    # non fallback silenzioso" (bug reale trovato in erpv6_color: prima
    # produceva 3 colori finti con solo un warning nel log) -- generalizzato
    # qui: se OGNI valore di CONTENUTO del risultato e' vuoto/falsy, la KB
    # non aveva nulla di utilizzabile per questo input, va segnalato, non
    # inventato. 'kb_request_id' e' escluso dal controllo: e' un campo di
    # servizio che process() aggiunge SEMPRE quando la specificita' e'
    # bassa (vedi _handle_generic_kb), non contenuto vero -- un bug reale
    # trovato in test: mascherava una palette vuota perche' kb_request_id
    # e' sempre un intero (quindi sempre "truthy").
    content = {k: v for k, v in result.items() if k != 'kb_request_id'} if isinstance(result, dict) else result
    if isinstance(content, dict) and content and not any(content.values()):
        raise UserError(_(
            "Nodo '%s': la KB '%s' non contiene dati utilizzabili per l'input fornito %r."
        ) % (node.name, kb.name, payload))
    return {'success': True, 'kb_id': kb.id, 'kb_name': kb.name, 'result': result}


def _run_heinrich_log_signal(env, node, input_data):
    """Motore IPO GENERICO (Denis, 29/08/2026, decomposizione erpv6_methodology):
    avvolge erpv6.heinrich.indicator.log_signal(), gia' un motore generico
    riusabile (get-or-create su res_model/res_id, incrementa il contatore
    giusto per severita') -- prima di questa registrazione era raggiungibile
    solo dal ramo cron_role='lettura' di run_scheduled_rule() sopra o da
    chiamate Python dirette (erpv6_kaizen), mai da un Nodo qualsiasi con
    process_key dichiarato a schermo (gap trovato nell'analisi EAOSv6 del
    29/08/2026 su erpv6_methodology: 'il motore esiste, manca solo la
    dichiarazione nel catalogo'). Non reimplementa la validazione di
    severity, la lascia al metodo reale (ValueError -> propagato cosi'
    com'e', coerente col resto del modulo che non inventa un default).
    Input: {'res_model': str, 'res_id': int, 'severity':
    'near_miss'|'lieve'|'grave', 'description': str opzionale}. Output:
    {'success', 'indicator_id', 'cultura_organizzativa'}."""
    required = ('res_model', 'res_id', 'severity')
    missing = [k for k in required if not input_data.get(k)]
    if missing:
        raise UserError(_("Input mancante: %s.") % ', '.join(missing))
    indicator = env['erpv6.heinrich.indicator'].log_signal(
        input_data['res_model'], int(input_data['res_id']), input_data['severity'],
        description=input_data.get('description'),
    )
    return {
        'success': True, 'indicator_id': indicator.id,
        'cultura_organizzativa': indicator.cultura_organizzativa,
    }


def _run_pareto_log_item(env, node, input_data):
    """Motore IPO GENERICO (Denis, 29/08/2026, decomposizione erpv6_methodology):
    avvolge erpv6.pareto.analysis.log_item(), stesso motore generico gia'
    riusabile (get-or-create sull'analisi + upsert per nome sull'item,
    ricalcolo cumulato immediato) gia' usato da erpv6_kaizen -- stesso gap
    del Motore Heinrich sopra, mai raggiungibile da un Nodo con process_key.
    Non reimplementa il vincolo frequenza/impatto 1-5 (gia' su erpv6.pareto.
    item via @api.constrains, propagato cosi' com'e' se violato). Input:
    {'res_model': str, 'res_id': int, 'name': str, 'frequenza': int (1-5),
    'impatto': int (1-5)}. Output: {'success', 'analysis_id', 'total_score',
    'priority_count'}."""
    required = ('res_model', 'res_id', 'name', 'frequenza', 'impatto')
    missing = [k for k in required if not input_data.get(k)]
    if missing:
        raise UserError(_("Input mancante: %s.") % ', '.join(missing))
    analysis = env['erpv6.pareto.analysis'].log_item(
        input_data['res_model'], int(input_data['res_id']), input_data['name'],
        int(input_data['frequenza']), int(input_data['impatto']),
    )
    return {
        'success': True, 'analysis_id': analysis.id,
        'total_score': analysis.total_score, 'priority_count': analysis.priority_count,
    }


# Elenco CHIUSO dei processi che un nodo Motore puo' eseguire -- stessa
# disciplina di SAFE_ACTIVATION_TRIGGERS sopra: mai un nome di funzione
# libero scelto da un form. Due famiglie (Denis, 29/08/2026, analogia
# pulsante/interruttore-relè): IPO = esegue codice vero direttamente,
# nessun intermediario. AIPO = deve passare per forza dal "relè"
# (erpv6_omni_bridge, che sceglie il provider AI) per funzionare -- stessa
# forma Input/Processo/Output, natura del Processo diversa.
SAFE_PROCESSES = {
    'generate_phase_document': {
        'label': '[IPO] Genera documento fase (Typst)',
        'family': 'ipo',
        'run': _run_generate_phase_document,
    },
    'ai_analyze': {
        'label': '[AIPO] Analizza con AI (chiamata reale omni_bridge)',
        'family': 'aipo',
        'run': _run_ai_analyze,
    },
    'kb_engine_process': {
        'label': '[IPO] Motore KB generico (erpv6.kb.engine.process, decide il rombo KB)',
        'family': 'ipo',
        'run': _run_kb_engine_process,
    },
    'send_to_documenso': {
        'label': '[ESTERNO] Invia a firma (Documenso, invio email reale, completamento asincrono)',
        'family': 'esterno',
        'run': _run_send_to_documenso,
    },
    'neo4j_write_fix': {
        'label': '[ESTERNO] Scrive nodo Fix su Neo4j (sincrono, MERGE reale)',
        'family': 'esterno',
        'run': _run_neo4j_write_fix,
    },
    'kaizen_signal_to_context': {
        'label': '[IPO] Segnale Kaizen → contesto reale (ponte verso un nodo AIPO)',
        'family': 'ipo',
        'run': _run_kaizen_signal_to_context,
    },
    'create_tracking_lot': {
        'label': '[IPO] Crea lotto di tracciamento (sigla azienda da res.company)',
        'family': 'ipo',
        'run': _run_create_tracking_lot,
    },
    'file_to_library': {
        'label': '[IPO] "Traslo" — archivia in libreria (register_document, mai bypassato)',
        'family': 'ipo',
        'run': _run_file_to_library,
    },
    'label_output': {
        'label': '[IPO] "Etichettatrice" — legge/crea la categoria dichiarata su un Output',
        'family': 'ipo',
        'run': _run_label_output,
    },
    'heinrich_log_signal': {
        'label': '[IPO] Segnala evento Heinrich (near_miss/lieve/grave, contatore trasversale)',
        'family': 'ipo',
        'run': _run_heinrich_log_signal,
    },
    'pareto_log_item': {
        'label': '[IPO] Aggiungi/aggiorna elemento backlog Pareto (80/20)',
        'family': 'ipo',
        'run': _run_pareto_log_item,
    },
    'crea_lead': {
        'label': '[IPO] Crea Lead (Fase 1 Acquisizione, solo crm.lead, type=lead)',
        'family': 'ipo',
        'run': _run_crea_lead,
    },
}


class Erpv6CoreNode(models.Model):
    _name = 'erpv6.core.node'
    _description = 'Nodo / Circuito (motore atomico o composito) del grafo Adaptive EOSv6'
    _order = 'parent_id, sequence, id'

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10, help='Ordina i nodi figli dentro un Circuito.')
    active = fields.Boolean(default=True)

    parent_id = fields.Many2one('erpv6.core.node', string='Circuito contenitore', ondelete='cascade')
    child_ids = fields.One2many('erpv6.core.node', 'parent_id', string='Nodi/Circuiti contenuti')

    is_composite = fields.Boolean(
        string='È un Circuito', default=False,
        help='False = Nodo atomico. True = Circuito: contiene child_ids (altri Nodi o Circuiti annidati).')
    circuit_role = fields.Selection([
        ('generico', 'Circuito generico'),
        ('pid', 'PID (control-loop parallelo auto-assestante)'),
    ], string='Ruolo Circuito', help='Ha senso solo se is_composite=True.')

    # Ancora verso la logica reale che questo Nodo/Circuito rappresenta --
    # stesso spirito del pattern res_model/res_id usato in erpv6_methodology,
    # ma qui punta a un METODO: un Nodo del grafo rappresenta una porzione di
    # comportamento di un motore esistente, non un dato da leggere.
    engine_model = fields.Char(
        string='Modello motore reale (solo documentazione)',
        help="Es. 'erpv6.validation.session' -- SOLO descrittivo, nessun codice legge "
             "questo campo per decidere cosa eseguire (verificato con Denis il "
             "29/08/2026: 'cosa succede se metto un nodo senza motore?' -- risposta "
             "onesta, niente, e' testo. Per un nodo che esegue DAVVERO usare "
             "process_key sotto, non questo campo.")
    engine_method = fields.Char(
        string='Metodo/hook reale (solo documentazione)',
        help="Es. 'action_start_validation'. Come sopra: solo testo descrittivo.")
    process_key = fields.Selection(
        [(k, v['label']) for k, v in SAFE_PROCESSES.items()],
        string='Processo Motore (Input/Processo/Output)',
        help="A differenza di engine_model/engine_method, QUESTO campo esegue "
             "davvero: elenco chiuso di processi verificati (mai un nome libero). "
             "Il nodo diventa un vero Motore IPO -- vedi run_process().")
    # Denis, 29/08/2026: "il gate non e' sui nodi, ma sulla fase come
    # principio di costruzione" -- circuit_role='gate' e' stato rimosso.
    # Il Gate ora e' un ruolo del nodo indipendente da is_composite/
    # circuit_role: quale nodo dentro una Fase fa da autorita' di
    # validazione/escalation. Selection (non booleano) perche' un flag
    # unico "e' un gate" non dice DI CHE TIPO -- umano o AI cambiano
    # comportamento reale (vedi human_gate_pending vs Motore AIPO). NB:
    # nessun nodo e' "Sesto Uomo" o "Arbitro" per costruzione -- sono solo
    # etichette su istanze AIPO qualunque, il comportamento lo decide
    # sempre e solo il prompt collegato (kb_link_ids), mai il nome.
    phase_gate_type = fields.Selection([
        ('umano', 'Gate umano — conferma manuale'),
        ('ai', 'Gate AI — arbitro (richiede Motore AIPO)'),
    ], string='Tipo Gate Fase',
        help="Questo nodo e' l'autorita' di validazione/escalation della Fase che lo "
             "contiene (erpv6.core.phase.node_ids) -- al massimo un nodo per Fase. "
             "'ai' richiede process_key='ai_analyze' gia' impostato; 'umano' richiede "
             "nessun Motore. Il tipo 'a tempo' (attesa/timeout) e' stato citato come "
             "possibile terza famiglia ma non e' ancora progettato -- non inventato qui.")
    test_fixture_ref = fields.Char(
        string='Materiale di test (xmlid)',
        help="Solo sul nodo radice di un Circuito: xmlid di un record creato apposta "
             "per i test (mai un record reale) -- Denis, 29/08/2026: 'creiamo sempre "
             "del materiale di test specifico, si deve creare quando si costruisce il "
             "circuito'. Risolto lato API in test_fixture_id.")
    analyst_index = fields.Char(
        string="Indice analista (motore reale)",
        help="Solo per Nodi che rappresentano un analista dei 6 Giudici: valore "
             "atteso in erpv6.validation.analysis.analyst_index ('1'..'5','sesto').")

    input_format = fields.Selection(
        TIPO_DATO_VOCABOLARIO, string='Formato input atteso',
        help='Usato solo per la validazione automatica di compatibilità con i rombi KB in '
             'ingresso (vedi erpv6.core.kb_link.format_mismatch) -- non blocca l\'esecuzione '
             'in questo pilota, e\' solo segnalazione visiva.')

    # Cron riusabile (Denis, 29/08/2026): generalizza il caso del nodo PID,
    # che rappresentava un cron reale (_cron_retry_escalated_ai_failures)
    # solo per convenzione di naming. Riusa ir.cron esistente di Odoo invece
    # di un modello cron parallelo -- coerente col principio "non duplicare"
    # del CLAUDE.md. cron_role distingue i due ruoli scoperti nel confronto
    # PID vs sensore Kaizen: un cron di LETTURA osserva e segnala (mai
    # riattiva nulla, es. erpv6_kaizen._cron_detect_signals), un cron di
    # ATTIVAZIONE agisce davvero sul sistema che monitora (es.
    # erpv6_validation._cron_retry_escalated_ai_failures, che richiama
    # _run_round()). Il grafo non deve mentire su quale dei due sta
    # rappresentando.
    cron_id = fields.Many2one('ir.cron', string='Cron collegato')
    cron_role = fields.Selection([
        ('lettura', 'Lettura (sensore, mai scrive/riattiva)'),
        ('attivazione', 'Attivazione (agisce davvero sul sistema monitorato)'),
        # Denis, 29/08/2026, decomposizione erpv6_kaizen: "la parte XML del
        # modulo vecchio resta uguale o va riscritta?" -- per i cron la
        # risposta e': ne' l'uno ne' l'altro, un terzo caso. Un modulo che
        # ha GIA' un vero ir.cron funzionante (es. i 4 cron reali di
        # erpv6_kaizen) non deve avere un secondo cron parallelo creato da
        # create_cron_node() che rifa' la stessa cosa -- vedi
        # wrap_existing_cron_node(). 'wrapped' e' puramente rappresentativo
        # nel grafo: il cron vero continua a girare sul proprio codice
        # originale, MAI riscritto per chiamare run_scheduled_rule().
        ('wrapped', 'Avvolto (rappresenta un cron reale gia\' esistente, non lo crea ne\' lo controlla)'),
    ], string='Ruolo Cron', help='Ha senso solo se cron_id e\' valorizzato.')

    # Regola del Cron (Denis, 29/08/2026): dominio di ricerca + cosa fare sui
    # record trovati. Per 'lettura' l'unica azione possibile e' registrare
    # un segnale Heinrich (mai scrivere altrove). Per 'attivazione' il
    # metodo NON e' testo libero: e' una chiave di SAFE_ACTIVATION_TRIGGERS,
    # scelta da un elenco chiuso, mai digitata.
    cron_domain = fields.Char(
        string='Dominio di ricerca (regola)', default='[]',
        help="Sintassi domain Odoo, es. \"[('status','=','escalated_to_human')]\". "
             "Vuoto/[] = tutti i record del modello.")
    cron_domain_model = fields.Char(
        string='Modello su cui cercare',
        help="Per 'lettura': qualunque modello. Per 'attivazione': deve combaciare "
             "col modello del trigger scelto (verificato all'attivazione del cron).")
    cron_trigger_key = fields.Selection(
        [(k, v['label']) for k, v in SAFE_ACTIVATION_TRIGGERS.items()],
        string='Trigger sicuro (solo attivazione)',
        help='Elenco chiuso -- mai un nome di metodo scritto a mano.')
    cron_severity = fields.Selection([
        ('near_miss', 'Near miss'), ('lieve', 'Lieve'), ('grave', 'Grave'),
    ], string='Severità segnale (solo lettura)')
    cron_description_template = fields.Char(string='Descrizione segnale (solo lettura)')

    @api.constrains('cron_role', 'cron_id')
    def _check_cron_role_only_with_cron(self):
        for rec in self:
            if rec.cron_role and not rec.cron_id:
                raise ValidationError(_(
                    "cron_role ha senso solo con un cron_id collegato -- nodo '%s'."
                ) % rec.name)

    def run_scheduled_rule(self):
        """Chiamato dal codice fisso di ir.cron (mai testo libero, vedi
        create_cron_node sotto): esegue la regola di QUESTO nodo. 'lettura'
        registra solo un segnale (mai scrive altrove). 'attivazione' invoca
        un trigger dell'elenco chiuso SAFE_ACTIVATION_TRIGGERS, mai un
        metodo arbitrario."""
        self.ensure_one()
        if not self.cron_role:
            return
        if self.cron_role == 'wrapped':
            # Un cron 'wrapped' non chiama mai questo dispatcher per
            # costruzione (il suo ir.cron reale punta al proprio codice
            # originale, mai riscritto) -- se ci si arriva comunque
            # (configurazione manuale errata), non-op esplicito, mai un
            #'lettura'/'attivazione' silenzioso su un cron che non e' nostro.
            return
        try:
            domain = ast.literal_eval(self.cron_domain or '[]')
        except (ValueError, SyntaxError):
            _logger.error("Nodo #%s: cron_domain non valido: %r", self.id, self.cron_domain)
            return

        if self.cron_role == 'lettura':
            if not self.cron_domain_model or self.cron_domain_model not in self.env:
                _logger.error("Nodo #%s: cron_domain_model mancante/non valido.", self.id)
                return
            records = self.env[self.cron_domain_model].search(domain)
            for rec in records:
                self.env['erpv6.heinrich.indicator'].log_signal(
                    self.cron_domain_model, rec.id, self.cron_severity or 'near_miss',
                    self.cron_description_template or self.name)

        elif self.cron_role == 'attivazione':
            trigger = SAFE_ACTIVATION_TRIGGERS.get(self.cron_trigger_key)
            if not trigger:
                _logger.error("Nodo #%s: cron_trigger_key non valido/assente.", self.id)
                return
            Model = self.env[trigger['model']]
            if trigger['call_style'] == 'model':
                getattr(Model, trigger['method'])()
            else:
                records = Model.search(domain)
                if records:
                    getattr(records, trigger['method'])()

    def run_process(self, input_data):
        """Esegue DAVVERO il Motore IPO di questo nodo -- vedi
        SAFE_PROCESSES/process_key sopra. Traccia ogni esecuzione (input e
        output reali) in erpv6.core.node.execution, cosi' il disegno mostra
        cosa e' successo davvero, non solo cosa dovrebbe succedere."""
        self.ensure_one()
        if not self.process_key:
            raise UserError(_("Nodo '%s' non ha un process_key -- non e' un Motore eseguibile.") % self.name)
        process = SAFE_PROCESSES.get(self.process_key)
        if not process:
            raise UserError(_("process_key '%s' non valido.") % self.process_key)

        # Assembla DAVVERO gli output dei nodi a monte (Denis, 29/08/2026:
        # "un IPO che riceve gli output di piu' IPO a monte") -- il grafo
        # guida l'input reale (ultima esecuzione riuscita di ogni nodo
        # collegato con un arco data_flow attivo), non serve piu' copiarli
        # a mano da un nodo all'altro.
        upstream_arcs = self.input_arc_ids.filtered(lambda a: a.active and a.action_type == 'data_flow')
        upstream_outputs = []
        for arc in upstream_arcs:
            last_exec = self.env['erpv6.core.node.execution'].search(
                [('node_id', '=', arc.source_node_id.id), ('status', '=', 'done')],
                order='id desc', limit=1,
            )
            if last_exec:
                upstream_outputs.append({'source_node': arc.source_node_id.name, 'output': last_exec.output_data})
        if upstream_outputs:
            input_data = dict(input_data)
            input_data['upstream_outputs'] = upstream_outputs

        # Output collegati ESPLICITAMENTE (Denis, 29/08/2026: "qualsiasi
        # output finito puo' essere un input da un'altra parte... non per
        # forza sono sequenziali") -- a differenza di upstream_outputs sopra
        # (che segue un arco data_flow diretto), output_link_ids funziona
        # anche tra nodi non collegati da nessun arco, come i rombi KB.
        linked_outputs = []
        for link in self.output_link_ids:
            linked_outputs.append({
                'source_node': link.output_id.source_node_id.name,
                'output_type': link.output_id.output_type,
                'value': link.output_id.resolve_value(),
            })
        if linked_outputs:
            input_data = dict(input_data)
            input_data['linked_outputs'] = linked_outputs

        execution = self.env['erpv6.core.node.execution'].create({
            'node_id': self.id, 'input_data': input_data, 'status': 'running',
        })

        # Morsettiera bloccante (Denis, 30/08/2026, prompt #6 -- basata sui
        # dati reali verificati nel prompt #5: 42 esecuzioni storiche, zero
        # falsi positivi, 5 veri positivi combacianti con status='failed'
        # gia' registrato). Riusa DAVVERO execution.firma_soddisfatta/
        # firma_mancanti (erpv6.core.node.execution._compute_firma_
        # soddisfatta, gia' calcolato qui perche' e' un compute store=True
        # e input_data/node_id sono gia' scritti da create() sopra) -- non
        # una seconda implementazione dello stesso controllo. kb_engine_
        # process ha zero righe in erpv6.core.process.input_spec (caso
        # limite del prompt #4, la firma variabile per kb_type resta SOLO
        # in KB_ENGINE_REQUIRED_INPUTS dentro _run_kb_engine_process) --
        # quindi firma_mancanti e' sempre vuoto per questo process_key,
        # mai bloccato qui, comportamento invariato.
        if not execution.firma_soddisfatta:
            error_message = _(
                "Input mancante per process_key='%s': %s -- morsettiera bloccata prima "
                "dell'esecuzione."
            ) % (self.process_key, execution.firma_mancanti)
            execution.write({'status': 'failed', 'error_message': error_message})
            raise UserError(error_message)

        try:
            output = process['run'](self.env, self, input_data)
            # Denis, 29/08/2026, decomposizione erpv6_sign: un Motore
            # Esterno asincrono (output['async']=True) NON e' 'done' solo
            # perche' la chiamata e' tornata -- l'invio a Documenso e'
            # l'inizio, non la fine. sign_request_id salvato qui cosi'
            # sign_request_ext.py puo' ritrovare e chiudere QUESTA
            # esecuzione quando arriva il completamento vero.
            write_vals = {'output_data': output}
            if output.get('async') and output.get('sign_request_id'):
                write_vals['status'] = 'in_attesa_esterna'
                write_vals['sign_request_id'] = output['sign_request_id']
            else:
                write_vals['status'] = 'done'
            execution.write(write_vals)
            # Output Binding (Denis, 29/08/2026): solo per completamento
            # sincrono ('done') -- un Motore Esterno asincrono si legherebbe
            # al completamento vero (webhook), non qui, fuori scopo per ora.
            # Dentro il try: se il binding fallisce, l'esecuzione va
            # marcata 'failed' come qualunque altro errore del Motore, non
            # e' un dettaglio opzionale se e' stato dichiarato sul nodo.
            if write_vals['status'] == 'done' and self.output_binding_model and self.output_binding_field:
                self._apply_output_binding(input_data, output)
        except Exception as e:
            execution.write({'status': 'failed', 'error_message': str(e)})
            raise
        return execution

    def _apply_output_binding(self, input_data, output):
        """Scrive DAVVERO il risultato del Motore su un campo di un record
        esterno (Denis, 29/08/2026: 'l'unico pezzo che rende una migrazione
        una vera sostituzione, non solo un avvolgimento parallelo, come
        self.write({'selected_palette': palette}) in erpv6_color'). Mai un
        fallback silenzioso: record mancante o percorso valore inesistente
        sono errori espliciti, non un campo lasciato vuoto in silenzio."""
        self.ensure_one()
        record_key = self.output_binding_record_key or 'binding_record_id'
        record_id = input_data.get(record_key)
        if not record_id:
            raise UserError(_(
                "Nodo '%s': output_binding dichiarato su %s.%s ma manca l'input '%s' -- "
                "non si sa su quale record scrivere."
            ) % (self.name, self.output_binding_model, self.output_binding_field, record_key))
        target = self.env[self.output_binding_model].browse(int(record_id))
        if not target.exists():
            raise UserError(_(
                "Nodo '%s': record %s#%s non trovato per l'output binding."
            ) % (self.name, self.output_binding_model, record_id))
        value = output
        if self.output_binding_value_path:
            for key in self.output_binding_value_path.split('.'):
                if not isinstance(value, dict) or key not in value:
                    raise UserError(_(
                        "Nodo '%s': percorso output_binding '%s' non trovato nell'output del "
                        "Motore (fermato su '%s')."
                    ) % (self.name, self.output_binding_value_path, key))
                value = value[key]
        target.write({self.output_binding_field: value})

    def run_circuit(self, initial_input=None):
        """'Esegui Circuito' (Denis, 29/08/2026): esegue TUTTI i nodi Motore
        di questo Circuito, in ordine topologico secondo gli archi
        data_flow attivi -- ogni nodo a valle riceve automaticamente gli
        output di quelli a monte (run_process lo fa gia'). Ritorna un log
        passo-passo reale (non simulato): quello che il frontend fa vedere
        e' esattamente quello che e' successo, nell'ordine in cui e'
        successo. Solo per circuiti "rapidi" (IPO/AIPO diretti, non i round
        multipli di erpv6_validation) -- sincrono, pensato per pochi nodi."""
        self.ensure_one()
        # Discendenza COMPLETA, non solo i figli diretti (Denis, 29/08/2026,
        # pacchetto "nodo radice"): "Esegui Circuito" su un Circuito che
        # contiene altri Circuiti (es. la radice che raggruppa 6 Giudici/
        # Produzione/Colori) deve trovare i Motori nei nipoti, non fermarsi
        # al primo livello -- stesso identico pattern gia' usato in
        # get_circuit() lato controller.
        all_descendants = self.browse()
        frontier = self
        while frontier:
            frontier = frontier.child_ids
            all_descendants |= frontier
        nodes = all_descendants.filtered(lambda n: n.process_key)
        if not nodes:
            raise UserError(_("Nessun nodo Motore (con process_key) dentro '%s'.") % self.name)

        # Ordine topologico semplice: ripete finche' trova un nodo i cui
        # genitori (fonti di archi data_flow attivi, dentro questo stesso
        # insieme) sono gia' stati eseguiti in questo giro.
        remaining = list(nodes.ids)
        node_by_id = {n.id: n for n in nodes}
        done_ids = set()
        # Denis, 30/08/2026, fix isolato: prima un nodo fallito (eccezione
        # catturata sotto) finiva comunque in done_ids -- i nodi a valle
        # vedevano la dipendenza "soddisfatta" e partivano lo stesso, senza
        # l'output a monte (run_process/resolve_value filtrano status='done',
        # quindi giravano con un upstream_outputs silenziosamente mancante
        # invece di essere bloccati). failed_ids tiene separati i nodi che
        # NON hanno prodotto un risultato utilizzabile -- sia per fallimento
        # vero (eccezione) sia per propagazione a cascata (skipped_dependency
        # qui sotto) -- cosi' un nodo a due livelli di distanza da un
        # fallimento si blocca anche lui, non solo il livello immediatamente
        # a valle.
        failed_ids = set()
        log = []
        guard = 0
        while remaining and guard < len(nodes) + 5:
            guard += 1
            progressed = False
            for node_id in list(remaining):
                node = node_by_id[node_id]
                deps = node.input_arc_ids.filtered(
                    lambda a: a.active and a.action_type == 'data_flow' and a.source_node_id.id in node_by_id
                ).mapped('source_node_id.id')
                failed_deps = [d for d in deps if d in failed_ids]
                if failed_deps:
                    # Nomina SOLO la dipendenza diretta fallita/skippata di
                    # QUESTO nodo -- la catena si propaga passo-passo (un
                    # nodo a due livelli da un fallimento riporta il nome
                    # del suo dipendente diretto, non l'origine remota).
                    failed_dep = node_by_id[failed_deps[0]]
                    log.append({
                        'node_id': node.id, 'node_name': node.name, 'status': 'skipped_dependency',
                        'error': "dipendenza a monte fallita: nodo '%s' (#%s)" % (failed_dep.name, failed_dep.id),
                    })
                    remaining.remove(node_id)
                    failed_ids.add(node_id)
                    progressed = True
                    continue
                if not all(d in done_ids for d in deps):
                    continue
                # Denis, 29/08/2026, trovato testando la sequenza tra
                # circuiti diversi: prima un nodo con dipendenze perdeva DEL
                # TUTTO initial_input (solo {}), corretto per un nodo che
                # riceve tutto dall'arco ma sbagliato per uno che ha BISOGNO
                # sia del contesto a monte sia di parametri propri (es.
                # 'Genera Palette' con un arco in ingresso ma che richiede
                # comunque disc/target espliciti) -- ora initial_input
                # arriva sempre a tutti, upstream_outputs si aggiunge sopra
                # (run_process lo fa gia'), mai lo sostituisce.
                step_input = dict(initial_input or {})
                try:
                    execution = node.run_process(step_input)
                    log.append({
                        'node_id': node.id, 'node_name': node.name, 'status': execution.status,
                        'output_data': execution.output_data,
                    })
                    remaining.remove(node_id)
                    done_ids.add(node_id)
                except Exception as e:
                    log.append({'node_id': node.id, 'node_name': node.name, 'status': 'failed', 'error': str(e)})
                    remaining.remove(node_id)
                    failed_ids.add(node_id)
                progressed = True
            if not progressed:
                for node_id in remaining:
                    log.append({
                        'node_id': node_id, 'node_name': node_by_id[node_id].name,
                        'status': 'skipped', 'error': 'dipendenze non soddisfatte (ciclo o nodo a monte senza process_key)',
                    })
                break
        return log

    def action_activate_cron(self):
        """'Mettere online' un Cron creato durante il pilota (Denis,
        29/08/2026: creato sempre active=False, questa e' l'unica azione che
        lo fa girare davvero sul timer)."""
        for rec in self:
            if not rec.cron_id:
                raise UserError(_("Nodo '%s' non ha un cron collegato.") % rec.name)
            rec.cron_id.active = True

    @api.model
    def create_cron_node(self, vals):
        """Crea un Nodo Cron + il vero ir.cron collegato, SEMPRE
        active=False (va attivato esplicitamente con action_activate_cron --
        'quando usciamo dalla prova e mettiamo online correttamente
        diventano cron veri', Denis 29/08/2026). Il campo 'code' di ir.cron
        e' SEMPRE lo stesso identico dispatcher fisso, mai testo passato da
        fuori."""
        cron_role = vals.get('cron_role')
        if cron_role not in ('lettura', 'attivazione'):
            raise UserError(_("cron_role deve essere 'lettura' o 'attivazione'."))
        if cron_role == 'attivazione' and vals.get('cron_trigger_key') not in SAFE_ACTIVATION_TRIGGERS:
            raise UserError(_("cron_trigger_key non valido -- deve essere uno dei trigger sicuri noti."))

        # Creato in due passi: il vincolo _check_cron_role_only_with_cron
        # impone cron_role+cron_id insieme, ma il codice del cron ha
        # bisogno dell'id del nodo, che non esiste finche' non lo si crea --
        # quindi si crea prima il nodo SENZA cron_role, poi si scrivono
        # cron_role e cron_id insieme in un solo write() (bug reale trovato
        # nel primo giro di test, 29/08/2026: creare gia' con cron_role
        # valorizzato ma senza cron_id violava il vincolo all'istante).
        create_vals = {'name': vals['name']}
        if vals.get('parent_id'):
            create_vals['parent_id'] = int(vals['parent_id'])
        # Un cron di ruolo 'attivazione' e' il vero PID ("attivazione di un
        # circuito assestante e parallelo generico", Denis 29/08/2026): va
        # marcato is_composite+circuit_role='pid' qui in creazione, non solo
        # documentato -- altrimenti resta un nodo Cron anonimo, invisibile
        # come PID nel grafo. Un cron 'lettura' e' un sensore (es. Kaizen),
        # non un PID: non forza alcun circuit_role.
        if cron_role == 'attivazione':
            create_vals['is_composite'] = True
            create_vals['circuit_role'] = 'pid'
        node = self.create(create_vals)
        model_record = self.env['ir.model']._get(self._name)
        # Odoo 18: ir.cron non ha piu' model_id/state/code/numbercall/doall
        # diretti (rimossi rispetto alle versioni precedenti) -- delega
        # l'esecuzione a un ir.actions.server collegato via
        # ir_actions_server_id. Creato qui, mai esposto/editabile da fuori:
        # il suo 'code' e' sempre lo stesso dispatcher fisso.
        server_action = self.env['ir.actions.server'].sudo().create({
            'name': 'Adaptive EOSv6 — %s' % node.name,
            'model_id': model_record.id,
            'state': 'code',
            'code': 'model.browse(%d).run_scheduled_rule()' % node.id,
        })
        cron = self.env['ir.cron'].sudo().create({
            'cron_name': 'Adaptive EOSv6 — %s' % node.name,
            'ir_actions_server_id': server_action.id,
            'interval_number': int(vals.get('interval_number') or 30),
            'interval_type': vals.get('interval_type') or 'minutes',
            'active': False,
        })
        node.write({
            'cron_role': cron_role,
            'cron_id': cron.id,
            'cron_domain': vals.get('cron_domain') or '[]',
            'cron_domain_model': vals.get('cron_domain_model'),
            'cron_trigger_key': vals.get('cron_trigger_key'),
            'cron_severity': vals.get('cron_severity'),
            'cron_description_template': vals.get('cron_description_template'),
        })
        return node

    @api.model
    def wrap_existing_cron_node(self, vals):
        """PID che rappresenta un ir.cron GIA' ESISTENTE e reale (Denis,
        29/08/2026, decomposizione erpv6_kaizen -- i 4 cron reali del
        modulo, es. cron_kaizen_detect_signals ogni 30 minuti), senza
        crearne uno parallelo che rifarebbe la stessa cosa due volte.
        Diverso da create_cron_node(): qui cron_id punta a un ir.cron che
        gia' esiste e gira sul proprio codice originale (MAI riscritto per
        chiamare run_scheduled_rule()) -- questo nodo e' puramente
        rappresentativo nel grafo, non lo controlla, non lo attiva/
        disattiva. Input: {'name': str, 'parent_id': int opzionale,
        'cron_id': int (id del vero ir.cron da rappresentare)}."""
        cron_id = vals.get('cron_id')
        if not cron_id:
            raise UserError(_("cron_id obbligatorio: l'id del vero ir.cron gia' esistente da rappresentare."))
        cron = self.env['ir.cron'].sudo().browse(int(cron_id))
        if not cron.exists():
            raise UserError(_("ir.cron #%s non trovato.") % cron_id)
        create_vals = {
            'name': vals['name'],
            'is_composite': True,
            'circuit_role': 'pid',
            'cron_role': 'wrapped',
            'cron_id': cron.id,
            'cron_description_template': vals.get('cron_description_template') or cron.cron_name,
        }
        if vals.get('parent_id'):
            create_vals['parent_id'] = int(vals['parent_id'])
        return self.create(create_vals)

    input_arc_ids = fields.One2many('erpv6.core.arc', 'target_node_id', string='Archi in ingresso')
    output_arc_ids = fields.One2many('erpv6.core.arc', 'source_node_id', string='Archi in uscita')
    kb_link_ids = fields.One2many('erpv6.core.kb_link', 'target_node_id', string='Rombi KB collegati')
    output_ids = fields.One2many(
        'erpv6.core.output', 'source_node_id', string='Output dichiarati (prodotti da questo nodo)')
    output_link_ids = fields.One2many(
        'erpv6.core.output_link', 'target_node_id',
        string='Output collegati in ingresso (di un altro nodo, non per forza a monte diretto)')

    # Output Binding (Denis, 29/08/2026, decomposizione erpv6_color: "il
    # risultato del Motore torna scritto sul campo del record che ha
    # chiamato il circuito" -- senza questo, nessuna migrazione puo' mai
    # sostituire davvero un metodo esistente che scrive su un campo del
    # chiamante, resta sempre un residuo di codice ponte). Dichiarato sul
    # nodo (statico: questo Motore scrive sempre nello stesso modello/
    # campo), il record specifico e il valore da scrivere sono risolti a
    # runtime in run_process().
    output_binding_model = fields.Char(
        string='Output Binding: modello',
        help="Es. 'erpv6.brand.project' -- se impostato insieme a output_binding_field, "
             "il risultato del Motore viene scritto DAVVERO su un record di questo modello, "
             "non solo loggato in erpv6.core.node.execution.")
    output_binding_field = fields.Char(
        string='Output Binding: campo',
        help="Es. 'selected_palette' -- il campo del record su cui scrivere il valore risolto.")
    output_binding_record_key = fields.Char(
        string='Output Binding: chiave input record_id', default='binding_record_id',
        help="Chiave in input_data che contiene l'id del record su cui scrivere -- chi lancia "
             "il Motore deve fornirla esplicitamente, mai indovinata.")
    output_binding_value_path = fields.Char(
        string='Output Binding: percorso valore',
        help="Percorso punteggiato dentro l'output del Motore (es. 'result.palette') -- se "
             "vuoto, scrive l'intero output. Risolto senza inventare fallback: se il percorso "
             "non esiste nell'output, e' un errore esplicito, non un campo vuoto silenzioso.")

    @api.constrains('circuit_role', 'is_composite')
    def _check_role_only_on_composite(self):
        for rec in self:
            if rec.circuit_role and not rec.is_composite:
                raise ValidationError(_(
                    "circuit_role ha senso solo su un Circuito (is_composite=True) -- "
                    "nodo '%s' è atomico ma ha circuit_role='%s'."
                ) % (rec.name, rec.circuit_role))

    @api.constrains('phase_gate_type', 'process_key')
    def _check_phase_gate_type_matches_motore(self):
        # 'ai' non impone process_key='ai_analyze': il Sesto Uomo reale dei
        # 6 Giudici e' un gate AI vero ma passa da erpv6_validation._run_round
        # (engine_model/engine_method, wrapping reale), non da SAFE_PROCESSES
        # -- solo il Motore IPO deterministico (Typst) e' vietato su un Gate,
        # non serve a validare nulla.
        for rec in self:
            if rec.phase_gate_type == 'ai' and rec.process_key == 'generate_phase_document':
                raise ValidationError(_(
                    "Gate AI su '%s' non può avere un Motore IPO deterministico -- "
                    "un Gate valuta/decide, non genera documenti."
                ) % rec.name)
            if rec.phase_gate_type == 'umano' and rec.process_key:
                raise ValidationError(_(
                    "Gate umano su '%s' non può avere anche un Motore -- se serve "
                    "un'analisi automatica prima della conferma umana, va su un nodo "
                    "separato a monte, non sullo stesso nodo."
                ) % rec.name)

    @api.constrains('phase_gate_type')
    def _check_single_gate_per_phase_from_node(self):
        # Simmetrico a erpv6.core.phase._check_single_gate_per_phase: quel
        # vincolo scatta solo quando SI SCRIVE phase.node_ids -- se invece si
        # attiva phase_gate_type direttamente sul nodo (il caso reale in UI,
        # vedi create_node/update_node), phase.node_ids non cambia e il
        # vincolo lato Fase non si attiva mai (bug reale trovato in test
        # 29/08/2026: due Gate nella stessa Fase creabili senza errore).
        for rec in self:
            if not rec.phase_gate_type:
                continue
            phases = self.env['erpv6.core.phase'].search([('node_ids', 'in', rec.id)])
            for phase in phases:
                other_gates = phase.node_ids.filtered('phase_gate_type') - rec
                if other_gates:
                    raise ValidationError(_(
                        "La Fase '%s' ha già un Gate (%s) -- al massimo un Gate per Fase."
                    ) % (phase.name, other_gates[0].name))
