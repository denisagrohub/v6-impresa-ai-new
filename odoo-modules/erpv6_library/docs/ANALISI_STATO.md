# erpv6_library — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.library.document` | `project_id` (M2O `crm.lead`, required), `name`, `category` (Selection: nda/proposal/sal/contract/business_plan/final/client_upload/other/brand_logo/brand_asset), `origin` (Selection: generated/client_upload/internal_upload), `source_model`/`source_res_id` (riferimento generico a un record sorgente), `file`/`file_name` (Binary), `is_final_client_facing`, `blockchain_record_id` (M2O `erpv6.blockchain.record`) | Modello con logica di business reale (non solo anagrafica): eredita `erpv6.tracking.mixin` (da `erpv6_tracking`) e integra certificazione blockchain (`erpv6_blockchain`) |
| `erpv6.brand.project` (estensione via `_inherit`) | Aggiunge `selected_logo_asset_id` (M2O `erpv6.library.document`) | Non è un modello proprio del modulo, solo un'estensione di `erpv6_brand` |

Nessun record di access rule specifico per `erpv6.brand.project` in questo modulo (corretto: il modello è definito in `erpv6_brand`, qui viene solo esteso).

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`action_certify_blockchain()`** — richiamato realmente da un bottone nella form view (`erpv6_library/views/library_views.xml:10`). Calcola l'hash del documento (dal file sorgente se `origin='generated'`, dal file caricato altrimenti) e crea/certifica un `erpv6.blockchain.record`. **Usato.**
- **`register_document(project_id, name, category, origin, ...)`** — `@api.model`, pensato esplicitamente come helper pubblico per la creazione di documenti da altri moduli (docstring completa con descrizione parametri). **Nessun chiamante trovato** in tutto il repo (`odoo-modules/`, `apps/`): l'API gateway (`erpv6_api_gateway/controllers/library_api.py`) crea i documenti con una `create(vals)` diretta invece di usare questo helper, duplicando parte della logica (inclusa la mancata chiamata automatica a `action_certify_blockchain` per i documenti finali creati via API). È codice morto/non consumato, nonostante sia progettato per esserlo.

## Punti di estensione noti

- `source_model`/`source_res_id` è un pattern di link generico (stesso principio di `res_model`/`res_id` visto in `erpv6_methodology`) — punto di estensione corretto per collegare documenti generati da qualsiasi modulo sorgente.
- `FILE_FIELD_CANDIDATES` (tupla di nomi campo: `pdf_file`, `file`, `signed_document`, `content`) è un meccanismo di duck-typing per recuperare il file da moduli sorgente eterogenei senza dipendenze dirette — estensione pulita, ma implicita: aggiungere un nuovo modulo sorgente con un nome di campo file diverso da questi 4 richiede comunque una modifica a questa tupla nel codice di `erpv6_library`, quindi non è estensione "a costo zero".
- `category` è una Selection hardcoded (10 valori, incluse 2 aggiunte specifiche per brand: `brand_logo`, `brand_asset`) — non è un campo libero, coerente comunque con l'uso come tassonomia di documenti, non come conoscenza di settore.
- Non pertinente ai principi di orchestrazione Kaizen/Opportunity/Bandi del CLAUDE.md — questo modulo è infrastruttura documentale trasversale, non tocca quel dominio.

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.1.0.0`. Coincide con il `version` dichiarato nel `__manifest__.py` locale (`18.0.1.0.0`) — nessun drift.
- Modulo effettivamente consumato: `erpv6_api_gateway` lo referenzia in 3 controller (`library_api.py`, `file_api.py`, `project_api.py`) e `erpv6_marketing/models/logo_generator.py` lo usa per salvare i loghi generati — non è codice isolato.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- `register_document()` è un helper pubblico ben documentato ma **mai chiamato**: l'API gateway lo bypassa e reimplementa la creazione a mano, perdendo la certificazione blockchain automatica per i documenti finali creati via API (il flag `is_final_client_facing` viene passato ma `action_certify_blockchain()` non viene invocato in `library_api.py`). Rischio concreto: documenti marcati come finali/client-facing creati via API REST che non vengono mai certificati su blockchain.
- Nessun test automatico.
- `FILE_FIELD_CANDIDATES` è una lista chiusa mantenuta a mano — ogni nuovo modulo "sorgente" di documenti generati richiede una modifica qui, non è vera estensione a runtime.
