# erpv6_omni_bridge — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.omni.bridge` (`AbstractModel`) | Nessun campo — solo il metodo `execute_ai_task()` | Motore di esecuzione: proxy verso i provider AI esterni |
| `erpv6.omni.provider` | `name`, `code` (univoco), `provider_type` (llm/transcription/embedding/image/speech), `api_key` (cifrato automaticamente con `erpv6_crypto` in create/write), `api_url`, `priority`, `is_active`, `cost_per_1k_input/output`, `total_calls`/`total_cost`/`success_rate` (compute da `call_log_ids`), `last_error`/`last_error_at` | Anagrafica + logica di cifratura/decifratura reale, non solo dati |
| `erpv6.omni.route.config` | `task_type` (Char libero — chiave di lookup), `primary_provider_id`, `fallback_provider_ids` (M2M), `routing_strategy` (Selection: priority/cost/speed/balanced/round_robin), `max_retries`, `kb_module_ids` (M2M a `erpv6.kb`) | Configurazione di routing — vedi incoerenza sotto |
| `erpv6.omni.call.log` | `task_type`, `provider_id`, `model_used`, `input_tokens`/`output_tokens`, `cost_usd`, `status` (success/error/timeout/rate_limited), `duration_ms`, `res_model`/`res_id` (link generico), `session_id`, `partner_id`, `consultant_id` | Log/audit trail, con metodi di aggregazione statistica (`read_group`, non loop Python) |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`execute_ai_task(task_type, payload=None, prompt=None, context=None)`** su `erpv6.omni.bridge` — è il metodo centrale del modulo, esplicitamente documentato nella docstring come punto di ingresso per altri moduli. **Uso reale confermato**: chiamato da `erpv6_api_gateway/controllers/ai_api.py`, `erpv6_validation/models/validation_session.py`, `erpv6_marketing` (2 file), `erpv6_package/wizard/generate_module_metadata_wizard.py`, `erpv6_deep_source/models/deep_source_engine.py`, oltre che dal proprio controller interno.
- **`get_decrypted_api_key()`** su `erpv6.omni.provider` — usato internamente da `execute_ai_task`, correttamente non esposto ad altri livelli (commento esplicito nel codice: "MAI esporre al frontend").
- **`get_optimal_model(task_type, context=None)`** su `erpv6.omni.provider` — chiamato dal controller interno del modulo (`controllers.py`), nessun altro modulo lo usa.
- **`get_stats_by_provider(days=30)`** e **`get_daily_cost_trend(days=30)`** su `erpv6.omni.call.log` — chiamati dal controller interno per dashboard di monitoraggio costi, nessun modulo esterno li chiama direttamente (probabile che l'accesso avvenga solo via REST).
- **`get_next_provider(attempted_providers=None)`** su `erpv6.omni.route.config` — **nessun chiamante trovato in tutto il repo**, nemmeno all'interno dello stesso modulo. È codice morto.

## Punti di estensione noti

- `task_type` come Char libero (non Selection) è il vero punto di estensione: qualsiasi modulo può registrare/consumare nuovi tipi di task senza modificare `erpv6_omni_bridge` — coerente col principio motore a-settoriale.
- `res_model`/`res_id` su `erpv6.omni.call.log` segue lo stesso pattern generico visto in `erpv6_methodology` e `erpv6_library`.
- `kb_module_ids` su `erpv6.omni.route.config` collega esplicitamente il routing AI a `erpv6_kb` — questo è uno dei pochi punti del repo dove un motore generico referenzia realmente `erpv6_kb` (a differenza di `erpv6_methodology`, che non lo fa).
- **Incoerenza reale rilevante**: `routing_strategy` (priority/cost/speed/balanced/round_robin) è un campo di configurazione completo, ma **non ha alcun effetto sull'esecuzione reale**. `execute_ai_task()` in `omni_bridge.py` costruisce la lista provider manualmente (`[primary] + fallback`, ordine di dichiarazione) e la scorre in sequenza, senza mai chiamare `get_next_provider()` — che è l'unico metodo che applica realmente `routing_strategy`. Il campo esiste, è configurabile da UI, ma è dato morto a runtime: chi imposta `routing_strategy='cost'` pensando di ottimizzare i costi non ottiene alcun effetto.
- Cifratura API key: gestita correttamente tramite `erpv6_crypto` (motore generico dedicato, non reinventata qui) — rispetta il principio motore/conoscenza.

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.2.0.0`. Coincide col `version` nel `__manifest__.py` locale (`18.0.2.0.0`) — nessun drift.
- Modulo ampiamente consumato: è dipendenza dichiarata/usata da almeno 6 altri moduli (verificato sopra) — è il motore AI centrale del progetto, non isolato.
- `erpv6_crypto.engine` (dipendenza per la cifratura) esiste realmente nel repo (`erpv6_crypto/models/crypto_engine.py`) — la dipendenza dichiarata nel manifest è reale, non solo nominale.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- `routing_strategy` è configurabile ma **inefficace** (vedi sopra) — rischio concreto di configurazione fuorviante per chi amministra i provider AI pensando di controllare costo/velocità.
- `get_next_provider()` è codice morto, mai chiamato — o va collegato realmente a `execute_ai_task()`, o va rimosso per evitare l'illusione che `routing_strategy` funzioni.
- Nessun test automatico, nonostante il modulo gestisca chiamate HTTP reali a servizi esterni a pagamento (rischio concreto di regressioni silenziose sui costi).
- `get_decrypted_api_key()` ha un fallback esplicito per "chiavi legacy in chiaro" con solo un warning nel log (`_logger.warning`) — non blocca l'uso di una chiave non cifrata, il commento nel codice stesso segnala "da migrare" ma non c'è meccanismo di enforcement.
