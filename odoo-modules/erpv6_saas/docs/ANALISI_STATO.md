# erpv6_saas — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.saas.tenant` | `name` (compute da `partner_id`), `partner_id`, `verticale` (Char libero), `api_key_id` (M2O `erpv6.api.key` — modello reale in `erpv6_api_gateway`), `subscription_status` (Selection: trial/active/expired/cancelled), `subscription_expires_at`, `setup_fee_paid`, `trial_ends_at`. Eredita `mail.thread` (tracking/chatter) | Modello con logica reale: cron di sincronizzazione stato sottoscrizione |
| `erpv6.vertical.catalog` | `verticale` (Char, dichiarato `unique=True` ma senza vincolo SQL corrispondente — vedi sotto), `name`, `module_names` (Text, lista moduli separati da virgola), `description`, `is_active` | Catalogo verticali → moduli, con metodo pubblico `get_modules_for_verticale()` |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`get_modules_for_verticale(verticale)`** su `erpv6.vertical.catalog` (`@api.model`) — **uso reale confermato**: chiamato da `erpv6_saas/controllers/saas_api.py` (endpoint `GET /api/v1/saas/verticals/<verticale>/modules`).
- **`_cron_sync_subscription_status()`** su `erpv6.saas.tenant` — metodo di cron (prefisso `_` ma registrato come job schedulato in `data/cron_data.xml`, eseguito giornalmente). Disattiva `api_key_id` quando una sottoscrizione trial/attiva scade.
- Entrambi i controller (`saas_api.py`, `saas_tenant_api.py`) espongono questi modelli via REST con autenticazione API Key obbligatoria (`_authenticate(require_auth=True)`), coerente col resto del progetto.

## Punti di estensione noti

- `module_names` come Text libero (lista CSV di nomi modulo) è un punto di estensione dati-driven: aggiungere un verticale non richiede codice, solo un nuovo record — coerente col principio motore/conoscenza.
- **Incoerenza reale**: il campo `verticale` su `erpv6.vertical.catalog` è dichiarato `unique=True` nell'attributo del campo Odoo, ma **non esiste un vincolo `_sql_constraints` corrispondente** nel modello — in Odoo, `unique=True` sull'attributo `fields.Char` non è un parametro standard che genera un vincolo DB (a differenza di `_sql_constraints`); è probabile che l'univocità del verticale non sia realmente garantita a livello di database, nonostante l'intento dichiarato nel codice.
- **Dipendenza dichiarata ma non usata**: il manifest dichiara `erpv6_kb` come dipendenza, ma **nessun file Python del modulo referenzia `erpv6.kb` o modelli di quel modulo** — la dipendenza è verificabilmente inerte nel codice attuale (potrebbe essere preparazione per uso futuro, ma allo stato attuale è morta).
- **Permessi ampi**: `security/ir.model.access.csv` dà a `base.group_user` (qualsiasi utente interno, non solo amministratori) diritti completi (`perm_write=1, perm_create=1, perm_unlink=1`) su entrambi i modelli — significa che qualunque utente interno può modificare stato sottoscrizione, cancellare tenant o alterare il catalogo verticali. Diverso dal pattern più restrittivo visto in altri moduli del progetto (es. `erpv6_omni_bridge`, dove `base.group_user` ha solo lettura).

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.1.0.0`. Coincide col `version` nel `__manifest__.py` locale — nessun drift.
- Cron giornaliero (`cron_sync_subscription_status`) registrato e attivo (`active=True` in `cron_data.xml`).
- Modulo consumato via API REST reale (2 controller, 3+ endpoint verificati).
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Permessi da rivedere**: accesso CRUD completo per `base.group_user` su dati sensibili (stato sottoscrizione, API key associata) — rischio concreto di modifica non autorizzata da parte di utenti interni non amministratori.
- `verticale` su `erpv6.vertical.catalog` non ha un vincolo di unicità reale a livello DB nonostante l'attributo `unique=True` dichiarato — rischio di duplicati silenziosi.
- Dipendenza da `erpv6_kb` dichiarata nel manifest ma non usata nel codice — o è debito di dipendenza superflua, o è preparazione per una feature non ancora implementata (dato mancante, non deducibile dal codice attuale).
- Nessun test automatico, nonostante il modulo gestisca cicli di vita di sottoscrizione e disattivazione API key (impatto diretto sull'accesso client alle API).
