# erpv6_api_gateway — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo (4 modelli, 18 file controller, ~54 route REST).

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.api.key` | `key` (generata `v6_<token>`), `key_hash` (compute SHA-256), `user_id`, `allowed_endpoints` (Char, `*` o lista pattern), `rate_limit_per_minute/day` (dichiarati ma **mai applicati**, vedi debiti), `expires_at` (dichiarato ma **mai controllato**, vedi debiti), `last_used`, `usage_count` | Autenticazione via Bearer token |
| `erpv6.api.log` | `endpoint`, `method`, `user_id`, `status_code`, `response_time_ms`, `ip_address`, `user_agent` | Logging reale, scritto da ogni controller tramite `_log_api_call` |
| `erpv6.webhook` | `url`, `events` (Selection 4 valori hardcoded), `secret` (auto-generato), metodo `trigger()` con firma HMAC-SHA256 | Logica reale e corretta (firma HMAC, header `X-Webhook-Signature`) — ma **nessun modulo lo chiama mai** (vedi debiti) |
| `erpv6.base` (estensione) | Nessun campo aggiunto | Il modello base è definito in `erpv6_core/models/base.py`; qui viene solo re-dichiarato con `_description` — estensione vuota |

## Metodi pubblici pensati per essere chiamati da altri moduli

Questo modulo è l'orchestratore/gateway REST del progetto ("Orchestratore API per Next.js e AI", dal manifest) — la sua "interfaccia pubblica" non sono metodi Python richiamati da altri moduli, ma le ~54 rotte HTTP esposte sotto `/api/v1/*`, raggruppate per dominio in 18 controller: accounting, ai, bandi, booking, file, kb, lead, library, methodology (12 rotte, la più estesa), partner, project, saas_vertical, sign, tracking, user, validation, più `main.py` (health/login) e `webhook`(model, non controller).

`APIBaseController` (in `main.py`) fornisce l'infrastruttura comune riusata da tutti gli altri controller: `_json_response()`, `_authenticate()` (Bearer API-key o JWT), `_log_api_call()`. Tutti i controller specifici ereditano da questa classe — è il vero "motore" del modulo.

## Punti di estensione noti

- **Pattern di dipendenza soft, verificato e coerente**: il manifest NON dichiara dipendenza da `erpv6_accounting`, eppure `controllers/accounting_api.py` referenzia `erpv6.fiscal.prediction`/`erpv6.deduction.suggestion`/`erpv6.asset.advisor`. Non è un bug: ogni endpoint fa esplicitamente `if 'erpv6.fiscal.prediction' not in request.env: return 501` prima di usarlo — lo stesso pattern verificato in `methodology_api.py`. È un design intenzionale di dipendenza opzionale/soft, applicato in modo coerente in tutto il modulo.
- Il manifest dichiara invece dipendenza **hard** da `erpv6_bandi`, `erpv6_methodology`, `erpv6_validation`, `erpv6_library` (con commenti espliciti nel manifest che spiegano perché: "richiesto da bandi_api.py" ecc.) — incoerenza nella scelta di quali dipendenze rendere hard vs soft, ma non è un errore, solo una scelta non documentata del perché alcune sì e altre no.
- `allowed_endpoints` su `erpv6.api.key` supporta pattern con wildcard (`prefix*`) — punto di estensione corretto per permessi granulari per API key.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.2.0.0`. Coincide con la versione nel manifest locale — nessun drift.
- Nessuna cartella `tests/` nonostante sia il modulo con la superficie pubblica più ampia ed esposta di tutto il progetto (autenticazione, ~54 endpoint).
- `data/default_api_keys.xml` è effettivamente caricato dal manifest (a differenza del caso analogo trovato in `erpv6_blockchain`).

### Debiti noti / TODO

- **Rate limiting dichiarato ma non implementato**: `rate_limit_per_minute` e `rate_limit_per_day` sono campi definiti su `erpv6.api.key` con default (60/min, 10000/giorno) ma **nessun controller o metodo del modulo li legge o li applica**. `_authenticate()` in `main.py` aggiorna solo `usage_count` e `last_used`, senza mai controllare i limiti. Il rate limiting descritto dal modello è quindi solo apparente.
- **Scadenza chiave non verificata**: `expires_at` su `erpv6.api.key` è un campo scrivibile ma `_authenticate()` non lo controlla mai — una API key "scaduta" resta valida indefinitamente finché `is_active=True`.
- **Webhook mai attivato**: `erpv6.webhook.trigger()` ha una logica reale e corretta (firma HMAC), ma **nessun controller o modello in tutto il repository chiama `.trigger()`** (verificato con grep incrociato) — gli eventi dichiarati nella Selection (`kb.article.created`, `booking.token.booked`, `lead.created`, `kb.article.updated`) non vengono mai effettivamente emessi da nessuna parte del codice. È infrastruttura pronta ma non collegata.
- Due controller paralleli per lo stesso dominio, già osservato da altri moduli (`erpv6_bandi`, `erpv6_accounting`): questo gateway duplica endpoint che esistono anche nei moduli stessi (es. `/api/v1/bandi/*` qui vs `/api/v6/bandi/*` in `erpv6_bandi`), con implementazioni scritte indipendentemente — rischio di comportamento divergente tra le due.
- CORS aperto a tutti (`Access-Control-Allow-Origin: *`) su `_json_response()`, applicato a tutte le risposte del gateway — ragionevole per API pubbliche via token, ma va tenuto presente come superficie.
- Nessun test automatico per un modulo che è l'intero livello di autenticazione/autorizzazione REST del progetto.
