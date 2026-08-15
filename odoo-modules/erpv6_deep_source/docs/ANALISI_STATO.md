# erpv6_deep_source — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.deep.source.config` | `name`, `source_type` (Selection: api/scraper), `fetch_type` (Selection: google_trends/amazon/generic_scraper), `target_url_pattern`, `api_credentials` (cifrate automaticamente in `create`/`write`), `kb_category_id` (Many2one `erpv6.kb.category`, required), `default_extraction_schema` (Json), `is_active`, `last_run`, `last_run_status`, `last_run_error` | Modello concreto, configurazione delle fonti esterne. Ha logica reale (cifratura credenziali, azione manuale) |
| `erpv6.deep.source.engine` | Nessun campo persistente (`models.AbstractModel`) | Motore di estrazione, non persistente — orchestratore puro |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.deep.source.config.action_execute_now()` — richiamabile da bottone UI (`type="object"`, verificato nel model: gestisce try/except e ritorna notifica client). Esegue l'estrazione per la configurazione corrente.
- `erpv6.deep.source.config.get_decrypted_credentials()` — pensato per uso interno/da altri moduli per ottenere le credenziali in chiaro.
- `erpv6.deep.source.engine.search_and_extract(source_config_id, context_extra=None, extraction_schema_override=None)` — è il metodo principale del motore: recupera contenuto grezzo (scraper HTTP o API ufficiale), chiama `erpv6_omni_bridge` (`omni_bridge.execute_ai_task`) per l'estrazione strutturata via AI, e salva il risultato in `erpv6.kb`.
- **Nessun altro modulo nel repo chiama `search_and_extract` o `erpv6.deep.source.*`** (grep incrociato su tutto `odoo-modules/` e `apps/`: zero occorrenze fuori dal modulo stesso) — il metodo è pubblico e ben strutturato, ma **allo stato attuale è raggiungibile solo dal bottone UI `action_execute_now`**, non da automazioni esterne o altri moduli.

## Punti di estensione noti

- `_fetch_from_official_api` è un dispatcher esplicitamente estendibile per `fetch_type`, ma **entrambe le implementazioni concrete (`_fetch_google_trends`, `_fetch_amazon`) sono stub che sollevano `NotImplementedError`** con un messaggio che spiega cosa manca (credenziali, libreria) — commentato nel codice stesso come `TODO`. Il source_type `scraper` invece è pienamente implementato (chiama un microservizio HTTP esterno configurabile via `ir.config_parameter` `deep_source.scraper_url`).
- `kb_category_id` collega ogni fonte a una categoria di `erpv6_kb` — questo è un punto di integrazione reale col principio "motore vs conoscenza" del CLAUDE.md: il modulo salva l'output estratto in `erpv6.kb` (tramite `_save_to_kb`), quindi la conoscenza raccolta finisce correttamente nel repository di conoscenza centralizzato, non duplicata localmente.
- `kb_type` usato in `_save_to_kb` è hardcoded a `'document'` con un commento esplicito nel codice (`# Default, da adattare in base alla categoria`) — punto di estensione dichiarato ma non implementato: la mappatura categoria→kb_type reale non esiste ancora.
- Dipende da `erpv6_kb`, `erpv6_omni_bridge`, `erpv6_crypto` (tutti dichiarati nel manifest e effettivamente usati nel codice, non solo dichiarazioni vuote).

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_deep_source` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) coincide con la versione installata: nessun drift rilevato.
- Dichiarato come dipendenza da `erpv6_bandi` e `erpv6_package`, ma grep sul codice Python di questi due moduli non mostra riferimenti diretti a `erpv6.deep.source.*` — come per altri casi analoghi in questo batch, la dipendenza dichiarata potrebbe essere ereditata/non ancora sfruttata. Dato da verificare, non lo dichiaro con certezza.
- Il modulo richiede un microservizio esterno (`http://scraper:8090/render`, configurabile) per il `source_type='scraper'` — non ho verificato (fuori scope, richiederebbe accesso alla rete Docker) se questo servizio sia effettivamente attivo sul VPS.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- Due dei tre `fetch_type` dichiarati (`google_trends`, `amazon`) sono stub non implementati — segnalato esplicitamente nel codice con `NotImplementedError` e commenti `TODO`, non un'invenzione di questa analisi.
- Mappatura `kb_type` in `_save_to_kb` hardcoded a `'document'` con TODO esplicito nel codice — la categorizzazione automatica in KB non riflette ancora il tipo reale del contenuto estratto.
- Nessun modulo nel repo chiama il motore di estrazione a livello programmatico: è raggiungibile solo manualmente da UI — se l'intento è automazione (es. cron periodici), non è ancora cablato.
- Nessun test automatico, incluso per la logica di retry verso il microservizio scraper (2 tentativi con sleep, gestione errori di rete).
