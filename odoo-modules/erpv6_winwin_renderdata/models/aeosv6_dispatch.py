import json
import logging
from datetime import date

from odoo import _
from odoo.exceptions import UserError

from odoo.addons.erpv6_core_dispatch.registry import register_process

_logger = logging.getLogger(__name__)


def _to_float(value):
    """Converte un valore risposta intervista (sempre gia' un numero
    'pulito' - input HTML type=number per le domande dirette, str(numero)
    JSON per l'estrazione documento, mai formattato con separatori delle
    migliaia) in float, o None se non interpretabile con certezza. Nessuna
    normalizzazione euristica di formati ambigui: e' meglio lasciare il
    dato fuori (missing) che fraintenderlo."""
    if value in (None, False, ''):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).strip().replace('€', '').replace(' ', '')
    try:
        return float(cleaned)
    except ValueError:
        return None


def _classify_band(value, band_spec):
    """Confronta value contro le bande stringa della KB soglie (es.
    '>1.5', '1.2-1.5', '<1.2', '<50%'). Parsing minimale delle sole forme
    usate in kb_winwin_thresholds_data.xml, non un parser di espressioni
    generico - se la KB usasse una sintassi diversa, questo ritorna
    'non_classificabile' invece di indovinare."""
    def _match(expr):
        if not expr:
            return False
        expr = expr.replace('%', '').strip()
        try:
            if expr.startswith('>'):
                return value > float(expr[1:])
            if expr.startswith('<'):
                return value < float(expr[1:])
            if '-' in expr:
                lo, hi = expr.split('-')
                return float(lo) <= value <= float(hi)
        except ValueError:
            return False
        return False

    for banda in ('verde', 'ambra', 'rosso'):
        if _match(band_spec.get(banda)):
            return banda
    return 'non_classificabile'


def _run_winwin_renderdata_build(env, node, input_data):
    """Motore IPO 'winwin_renderdata_build' -- Fase 2 del circuito
    erpv6_winwin_renderdata. Legge SOLO dati grezzi gia' raccolti su
    erpv6.production.order (valorizzati per estrazione automatica dal
    bilancio/visura caricato, Percorso B, o per risposta diretta di
    fallback, Percorso A - vedi models/interview_extension.py). Nessuna
    business logic qui: la classificazione (bande soglia, criticita',
    azioni urgenti) vive in _classify(), che legge le soglie dalla KB via
    kb_link (mai hardcoded, vedi data/kb_winwin_thresholds_data.xml). La
    roadmap (deterministica, mai generativa) vive in _build_roadmap(),
    che riusa le azioni urgenti gia' calcolate + tempistiche standard da
    KB (kb_link con categoria 'Tempistiche Standard Processo (Win-Win)', vedi data/kb_roadmap_raccomandazione_data.xml).

    Input: {'production_order_id': int}. Output: {'raw': {...}, 'missing':
    [...], 'diagnosi': {'metriche': {...}}, 'criticita': [...],
    'azioni_urgenti': [...], 'roadmap': [...]}. Nessun campo mancante viene
    mai stimato: resta assente da 'raw'/'diagnosi.metriche' e compare in
    'missing'."""
    order_id = input_data.get('production_order_id')
    if not order_id:
        raise UserError(_("Input mancante: 'production_order_id'."))
    order = env['erpv6.production.order'].sudo().browse(order_id)
    if not order.exists():
        raise UserError(_("erpv6.production.order #%s non trovato.") % order_id)

    raw = {
        'fatturato_fascia': order.interview_fatturato or None,
        'fatturato_esatto': _to_float(order.interview_fatturato_esatto),
        'oneri_finanziari': _to_float(order.interview_oneri_finanziari),
        'ebitda': _to_float(order.interview_ebitda),
        'debito_finanziario': _to_float(order.interview_debito_finanziario),
        'patrimonio_netto': _to_float(order.interview_patrimonio_netto),
        'rimborso_capitale_annuo': _to_float(order.interview_rimborso_capitale_annuo),
        'data_ultima_visura': order.interview_data_ultima_visura or None,
        'contenzioso_in_corso': order.interview_contenzioso_in_corso or None,
        'bando_target': order.interview_bando_target or None,
        'settore': order.verticale or None,
    }
    missing = sorted(k for k, v in raw.items() if v in (None, ''))

    classification = _classify(node, raw)
    roadmap = _build_roadmap(node, raw, classification['azioni_urgenti'])

    return {
        'raw': raw,
        'missing': missing,
        'diagnosi': classification['diagnosi'],
        'criticita': classification['criticita'],
        'azioni_urgenti': classification['azioni_urgenti'],
        'roadmap': roadmap,
    }


def _resolve_kb_link(node, category_name):
    """Trova il kb_link del nodo per kb_category_id.name esplicito, non
    per indice posizionale (fragile: l'ordine dei record in kb_link_ids
    dipende dall'ordine di caricamento dei file XML, mai da garantire) ne'
    per il campo 'name' di erpv6.core.kb_link (e' COMPUTATO -
    _compute_name - qualunque valore scritto in XML viene sovrascritto,
    verificato dal vivo). Se il link richiesto non e' configurato, e' un
    errore di configurazione da far fallire esplicitamente, non un
    'missing' silenzioso - la KB e' un prerequisito del circuito, non un
    dato opzionale dell'intervista."""
    link = node.kb_link_ids.filtered(lambda l: l.kb_category_id.name == category_name)
    if not link:
        raise UserError(_("Nessun kb_link con categoria KB '%s' configurato sul nodo '%s'.") % (category_name, node.name))
    kb = link[0].resolve_kb()
    if not kb or not kb.content:
        raise UserError(_("KB '%s' non risolvibile o vuota (categoria '%s').") % (category_name, category_name))
    try:
        return json.loads(kb.content)
    except ValueError as exc:
        raise UserError(_("Contenuto KB '%s' non è JSON valido: %s") % (category_name, exc))


def _classify(node, raw):
    """Applica le soglie KB (risolte via kb_link del nodo, mai hardcoded)
    ai valori grezzi disponibili. Un indice non calcolabile per dati
    mancanti NON genera un valore stimato o un proxy sotto un'etichetta
    sbagliata (es. interest coverage ratio spacciato per DSCR): resta
    semplicemente assente da diagnosi.metriche - il/i campo/i mancanti che
    lo impediscono sono gia' in 'missing' del chiamante. Ogni voce riporta
    'fonte' per il gate 3A (claims_checked, Fase 3)."""
    thresholds = _resolve_kb_link(node, 'Soglie Metriche Finanziarie (Win-Win)')

    metriche = {}
    criticita = []
    azioni_urgenti = []

    # DSCR = EBITDA / servizio del debito (oneri finanziari + quota
    # capitale annua) - formula vera, richiede entrambi i componenti del
    # servizio del debito. Un proxy con solo gli oneri finanziari sarebbe
    # un interest coverage ratio, una metrica diversa: se manca la quota
    # capitale, DSCR resta non calcolato (gia' in 'missing'), mai
    # approssimato sotto l'etichetta sbagliata.
    if raw['ebitda'] is not None and raw['oneri_finanziari'] is not None and raw['rimborso_capitale_annuo'] is not None:
        debt_service = raw['oneri_finanziari'] + raw['rimborso_capitale_annuo']
        if debt_service > 0:
            dscr_spec = thresholds.get('dscr', {})
            dscr = round(raw['ebitda'] / debt_service, 2)
            stato = _classify_band(dscr, dscr_spec)
            metriche['dscr'] = {
                'valore': dscr, 'stato': stato, 'soglia': dscr_spec,
                'fonte': "EBITDA e servizio del debito (oneri finanziari + quota capitale) raccolti in intervista",
            }
            if stato == 'rosso':
                criticita.append({
                    'titolo': 'DSCR sotto la soglia minima',
                    'descrizione': _(
                        "Il rapporto tra EBITDA e servizio del debito è %(v)sx, sotto la soglia standard (%(r)s)."
                    ) % {'v': dscr, 'r': dscr_spec.get('riferimento', '')},
                    'fonte': 'calcolo deterministico su dati raccolti in intervista',
                })

    # Leva finanziaria = debito finanziario / (debito finanziario +
    # patrimonio netto) - formula vera, richiede il patrimonio netto (un
    # proxy debito/fatturato non e' "leva finanziaria" nel senso bancario
    # standard che le soglie della KB presuppongono).
    if raw['debito_finanziario'] is not None and raw['patrimonio_netto'] is not None:
        denom = raw['debito_finanziario'] + raw['patrimonio_netto']
        if denom > 0:
            leva_spec = thresholds.get('leva_finanziaria', {})
            leva = round((raw['debito_finanziario'] / denom) * 100, 1)
            stato = _classify_band(leva, leva_spec)
            metriche['leva_finanziaria'] = {
                'valore': leva, 'stato': stato, 'soglia': leva_spec,
                'fonte': "Debito finanziario e patrimonio netto raccolti in intervista",
            }
            if stato == 'rosso':
                criticita.append({
                    'titolo': 'Leva finanziaria elevata',
                    'descrizione': _(
                        "Il rapporto debito/(debito+patrimonio netto) è al %(v)s%%, sopra la soglia (%(r)s)."
                    ) % {'v': leva, 'r': leva_spec.get('riferimento', '')},
                    'fonte': 'calcolo deterministico su dati raccolti in intervista',
                })

    # Azioni urgenti: 2 regole deterministiche esplicite, scritte qui nel
    # Motore perche' sono condizioni fisse (non lookup su una tassonomia
    # di casi) - se in futuro crescono di numero/complessita', andranno
    # spostate in una KB categoria 'regole' dedicata (vedi nota aperta in
    # Fase 0 sul dispatcher _process_rules oggi irraggiungibile).
    if raw.get('contenzioso_in_corso') == 'Sì':
        azioni_urgenti.append({
            'titolo': 'Contenzioso legale in corso',
            'descrizione': "È stato dichiarato un contenzioso legale in corso: va valutato l'impatto prima "
                           "di procedere con richieste di finanziamento o bandi.",
            'fonte': 'risposta diretta/estrazione documento in intervista',
        })
    if raw.get('data_ultima_visura'):
        try:
            visura_date = date.fromisoformat(raw['data_ultima_visura'])
            months_old = (date.today() - visura_date).days / 30.0
            if months_old > 6:
                azioni_urgenti.append({
                    'titolo': 'Visura/bilancio non recente',
                    'descrizione': _(
                        "L'ultimo documento disponibile risale a circa %d mesi fa: molti bandi/banche "
                        "richiedono un documento aggiornato entro 6 mesi."
                    ) % int(months_old),
                    'fonte': 'data dichiarata in intervista',
                })
        except ValueError:
            _logger.warning("winwin_renderdata_build: data_ultima_visura non ISO ('%s'), ignorata.",
                             raw['data_ultima_visura'])

    return {'diagnosi': {'metriche': metriche}, 'criticita': criticita, 'azioni_urgenti': azioni_urgenti}


def _build_roadmap(node, raw, azioni_urgenti):
    """Prompt 'Roadmap + Raccomandazione' (06/09/2026): la roadmap e'
    deterministica, mai generata via AI - assembla passi da due sole fonti
    reali: (1) le azioni urgenti gia' calcolate da _classify() (stesso
    input di questa funzione, mai ricalcolate), diventano passi immediati;
    (2) le tempistiche standard di processo lette dalla KB (kb_link
    'tempistiche_roadmap', mai hardcoded), aggiunte SOLO se il processo a
    cui si applicano e' identificabile dal caso (oggi: presenza di
    bando_target). Se non c'e' nessuna azione urgente e nessun
    bando_target, la roadmap e' una lista vuota - mai un passo
    placeholder tipo 'istruttoria: tempi variabili'."""
    passi = []
    for azione in azioni_urgenti:
        passi.append({
            'titolo': azione['titolo'],
            'tempistica': 'Subito',
            'descrizione': azione['descrizione'],
        })

    bando = raw.get('bando_target')
    if bando:
        timings = _resolve_kb_link(node, 'Tempistiche Standard Processo (Win-Win)')
        finestra = timings.get('finestra_bando_generica')
        if finestra:
            passi.append({
                'titolo': 'Presentazione domanda — %s' % bando,
                'tempistica': '%s-%s giorni (%s)' % (
                    finestra['giorni_min'], finestra['giorni_max'], finestra['riferimento']),
                'descrizione': finestra['descrizione'],
            })
        istruttoria = timings.get('istruttoria_bancaria')
        if istruttoria:
            passi.append({
                'titolo': 'Istruttoria bancaria/dell\'ente erogatore',
                'tempistica': '%s-%s giorni (%s)' % (
                    istruttoria['giorni_min'], istruttoria['giorni_max'], istruttoria['riferimento']),
                'descrizione': istruttoria['descrizione'],
            })
    return passi


register_process(
    'winwin_renderdata_build',
    'Costruisci render_data Win-Win',
    'winwin',
    _run_winwin_renderdata_build,
)
