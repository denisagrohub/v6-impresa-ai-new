# erpv6_typst — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.typst.template` | `name`, `code` (univoco), `category` (Selection: business_plan/financial_report/bando_application/proposal/contract/custom), `kb_id` (Many2one `erpv6.kb`), `version`, `language`, `required_fields` (Json), `page_size`, `orientation`, `usage_count`/`last_used` (compute) | Logica reale, contenuto `.typ` salvato criptato in `erpv6_kb` |
| `erpv6.typst.document` | **Vedi sezione "Attenzione — definizione duplicata" sotto: il modello reale è l'unione di DUE classi Python distinte con lo stesso `_name`** | Logica reale ma con un difetto architetturale grave |
| `erpv6.typst.document.log` | `document_id`, `operation`, `details` (Json), `duration_ms`, `success`, `error`, `created_at` | Log tecnico |
| `erpv6.typst.engine` | `name`, `active`, `typst_path` | Utility, `check_typst_installed()` e `generate_document()` |

### Attenzione — definizione duplicata di `erpv6.typst.document`

Il modello `erpv6.typst.document` è definito **due volte** in due file diversi con lo stesso `_name`, senza `_inherit` esplicito:

1. **`models/typst_document.py`**: campi `data` (Text/JSON), `file_content`/`file_name`/`file_size` (Binary), `status` (draft/generated/sent/signed), `blockchain_hash`. Metodo `action_generate()` che compila **davvero** un PDF chiamando il binario `typst` via `subprocess` (`_generate_pdf_with_typst`).
2. **`models/typst_template.py`** (in coda al file, dopo la classe `TypstTemplate`): campi `render_data` (Json), `pdf_file`/`pdf_filename` (Binary), `partner_id`, `project_id`, `bando_match_id`, `status` (draft/rendering/ready/failed/sent — valori diversi dal primo!), `created_at`/`rendered_at`/`sent_at`, `log_ids`. Metodo `action_render()` che **non genera nessun PDF reale**: nel codice c'è la chiamata HTTP commentata (`# response = requests.post(...)`) e il commento esplicito `# Qui simuliamo il flusso` / `# Simulazione successo` — imposta solo `status = 'ready'` senza mai scrivere `pdf_file`.

`models/__init__.py` importa prima `typst_template` poi `typst_document`. In Odoo, più classi Python con lo stesso `_name` nello stesso modulo vengono unite in un unico modello (stesso meccanismo dell'ereditarietà per estensione): il modello finale `erpv6.typst.document` ha **tutti i campi di entrambe le classi** e **tutti i metodi di entrambe** (non ci sono nomi di metodo in conflitto tra le due, quindi nessuno dei due viene sovrascritto/perso). Le viste (`views/typst_document_views.xml`) usano esclusivamente i campi/bottoni della **seconda** definizione (`action_render`, `action_send_to_partner`, `action_download`, `created_at`, `render_data`, `pdf_file`) — confermato leggendo il file XML.

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.typst.engine.generate_document(template_id, res_model, res_id, data)` (`@api.model`): crea un documento e chiama `document.action_generate()` — cioè il percorso **reale** con subprocess Typst. Nessun altro file nel repository chiama questo metodo (verificato con grep) — è di fatto **orfano**, non raggiunto né da controller né da altri moduli.
- `erpv6.typst.template.action_sync_to_kb(typst_source_code)` e `get_typst_source()`: usati per salvare/leggere il sorgente `.typ` criptato in `erpv6_kb`. `get_typst_source()` è chiamato da `action_render()` sullo stesso modulo.
- **API REST reale** (`controllers/typst_api.py`, consumata dal frontend Next.js, `auth='user'`): `/api/v6/typst/templates`, `/api/v6/typst/render`, `/api/v6/typst/document/<id>/status`, `/api/v6/typst/document/<id>/send`, `/api/v6/typst/business-plan/data`. L'endpoint `/render` crea il documento e chiama `document.action_render()` — cioè il percorso **simulato/fake**, non quello che compila davvero con Typst.

## Punti di estensione noti

- `erpv6.typst.template.category` è una Selection chiusa (6 valori hardcoded) — per un nuovo tipo di documento serve modifica al codice, non è dato puro.
- Il contenuto `.typ` dei template è salvato criptato in `erpv6_kb` (`kb_id`) — questo è coerente col principio "motore vs conoscenza": il motore di rendering resta generico, il contenuto/testo dei template (specifico per verticale/uso) vive nella KB.
- Dipendenze dichiarate: `erpv6_kb`, `erpv6_consulting`, `erpv6_bandi`, `account`, `crm` — coerenti con l'uso dichiarato (Business Plan, Report Finanziari, Candidature Bandi).
- Non pertinente ai principi Kaizen/Opportunity/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`, `latest_version: 18.0.1.0.0` — coincide con `version` nel `__manifest__.py` locale. Nessun drift.
- **Bug funzionale grave verificato nel codice**: l'unico percorso di generazione documento **raggiungibile dal frontend** (`POST /api/v6/typst/render`, usato da Next.js) chiama `action_render()`, che è **una simulazione**: imposta `status='ready'` senza mai popolare il campo `pdf_file`. Il documento risulterà "pronto" nell'API/UI ma **senza un PDF reale allegato**. L'implementazione che compila davvero con Typst (`action_generate()` + subprocess) esiste nel codice ma non viene mai chiamata dal flusso API/frontend attuale — è raggiungibile solo tramite `erpv6.typst.engine.generate_document()`, che a sua volta non è chiamato da nessuna parte del repository.
- `erpv6.typst.document.action_download()` costruisce un URL verso `pdf_file` — se il documento è stato generato tramite il percorso reale usato dal frontend (`action_render`), quel campo binario sarà vuoto: il download risulterà in un file assente o vuoto.
- Nessuna cartella `tests/` che avrebbe potuto far emergere questo comportamento.

### Debiti noti / TODO

- **Priorità alta**: la generazione documenti esposta al frontend (`/api/v6/typst/render`) non produce PDF reali — è un placeholder mai completato, nonostante esista un'implementazione funzionante alternativa (`action_generate`) rimasta scollegata.
- **Priorità alta**: due classi Python distinte condividono `_name = 'erpv6.typst.document'` senza `_inherit` esplicito e con campi `status` con valori diversi e incompatibili tra loro — pattern fragile e fonte di confusione per chi manutiene il codice, anche se Odoo lo unisce senza errori di caricamento.
- Nessun test automatico.
- Nessuna verifica che il binario `typst` sia effettivamente installato nell'ambiente prima di tentare `_generate_pdf_with_typst` (il metodo `check_typst_installed()` esiste su `erpv6.typst.engine` ma non risulta chiamato da nessuna parte prima della generazione).
