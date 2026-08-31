from odoo import _
from odoo.exceptions import UserError

from odoo.addons.erpv6_core_dispatch.registry import register_process

# Denis, 29/08/2026: i 13 valori legacy di erpv6.library.document.category
# (Selection chiusa, mai toccata). Un'etichetta dichiarata da un circuito
# che coincide con uno di questi passa diretta; altrimenti 'other' per il
# campo legacy (che resta required=True), mentre l'etichetta precisa vive
# comunque in category_id (vero record, ora nativo qui -- vedi prompt #19).
LIBRARY_LEGACY_CATEGORY_VALUES = {
    'nda', 'proposal', 'sal', 'contract', 'business_plan', 'final', 'client_upload',
    'other', 'brand_logo', 'brand_asset', 'kb_source', 'kb_case_study', 'agent_knowledge',
}


def _run_label_output(env, node, input_data):
    """Motore IPO 'etichettatrice' (Denis, 29/08/2026, spostato da
    erpv6_core_engine/models/core_node.py nel prompt #19 -- sblocca §O per
    davvero): legge/CONFERMA l'etichetta di un Output -- non cerca/crea
    piu' la categoria lui stesso, la trova gia' risolta (category_id),
    perche' erpv6.core.output.create() ora la trova-o-crea nel momento
    stesso in cui l'Output viene dichiarato (in un data XML
    all'installazione del circuito, o via API) -- 'nel momento in cui si
    installa un circuito nuovo, il catalogo legge anche gli output e se
    non esistono li crea'. Questo Motore resta il punto che un circuito
    chiama per confermare esplicitamente l'etichettatura di un Output
    specifico prima di passarlo al Traslo. Input: {'output_id': int}.
    Output: {'success', 'category_id', 'category_name'}."""
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
    Spostato da erpv6_core_engine/models/core_node.py nel prompt #19.
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


register_process(
    'label_output',
    '[IPO] "Etichettatrice" — legge/crea la categoria dichiarata su un Output',
    'ipo', _run_label_output,
)
register_process(
    'file_to_library',
    '[IPO] "Traslo" — archivia in libreria (register_document, mai bypassato)',
    'ipo', _run_file_to_library,
)
