# erpv6_setup_wizard — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.setup.wizard` (TransientModel) | `state` (Selection: choose_vertical/installing/done), `parent_url`, `api_key`, `verticale_selezionato`, `available_verticals` (Text, readonly), `log` (Text, readonly) | Wizard transiente, nessun dato persistente — logica di orchestrazione installazione moduli, non anagrafica statica. |

Nessun altro modello nel modulo (solo un wizard TransientModel).

## Metodi pubblici pensati per essere chiamati da altri moduli

- `action_fetch_verticals()`: chiama `GET {parent_url}/api/v1/saas/verticals` con header `Authorization: Bearer {api_key}` e popola `available_verticals`. Pensato per essere richiamato da bottone UI del wizard.
- `action_install_verticale()`: chiama `GET {parent_url}/api/v1/saas/verticals/{verticale}/modules`, poi per ogni modulo restituito cerca il record `ir.module.module` e chiama `button_immediate_install()` se non già installato. Pensato per bottone UI.
- Entrambi i metodi sono decorati `@api.model` ma usano `self.ensure_one()` — pattern insolito ma non bloccante (su un wizard appena istanziato con un solo record in `self`, funziona; `@api.model` è comunque ridondante qui dato che i metodi operano sull'istanza).
- Nessun altro modulo nel repository referenzia `erpv6.setup.wizard` (verificato con grep) — è pensato per essere usato solo dall'utente umano tramite UI in fase di onboarding di una nuova istanza child SaaS, non per essere chiamato programmaticamente da altri moduli.

## Punti di estensione noti

- Il modulo dipende dal contratto REST esposto da `erpv6_saas` (endpoint `/api/v1/saas/verticals` e `/api/v1/saas/verticals/{verticale}/modules`) su un'istanza "parent" — questo è un punto di estensione dichiarato via URL configurabile (`parent_url`), non hardcoded, coerente con l'architettura multi-tenant SaaS.
- **Nessun collegamento diretto a `erpv6_kb`/`verticale`**: il wizard tratta `verticale_selezionato` come stringa libera ottenuta dinamicamente dal parent, quindi non introduce accoppiamento rigido — coerente con il principio motore/conoscenza (la logica di quali verticali esistono vive lato parent/KB, non qui).
- Non pertinente ai principi Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`, `latest_version: 18.0.1.0.0` — coincide esattamente con `version` dichiarata nel `__manifest__.py` locale (`18.0.1.0.0`). Nessun drift.
- Il manifest dichiara `"Modulo da installare SOLO sulle istanze child"` — sull'istanza VPS attuale (che sembra fungere anche da ambiente di sviluppo/staging) risulta comunque installato; non è possibile verificare da qui se questa istanza sia effettivamente una "child" o se il modulo sia installato per test.
- Nessuna cartella `tests/`.
- Nessun controller HTTP proprio (le chiamate HTTP escono verso il parent, non ne riceve).

### Debiti noti / TODO

- Nessun test automatico.
- Gestione errori solo tramite notifiche UI (`display_notification`) e log testuale nel campo `log` — non c'è retry né validazione dell'URL/API key prima del primo tentativo di chiamata.
- `action_install_verticale()` prosegue anche se un singolo modulo fallisce l'installazione (log dell'errore ma nessun rollback) — comportamento "best effort" intenzionale ma non documentato esplicitamente come tale nel codice.
- Nessun dato mancante rilevante da segnalare oltre a quanto sopra.
