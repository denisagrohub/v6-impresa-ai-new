# erpv6_parent_client — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.parent.client` (`AbstractModel`) | Nessun campo — solo metodi (`fetch`, `_get_parent_config`, `_generate_cache_key`) | Client HTTP verso un'istanza "parent" SaaS, con cache locale e fallback su cache scaduta in caso di errore di rete |
| `erpv6.parent.cache` | `cache_key` (univoco), `content` (Text, JSON serializzato), `fetched_at`, `ttl_hours` (default 24), `category` | Modello di cache, con `is_valid()` (confronto TTL) e `get_data()` (deserializzazione JSON) |

Il modulo è esplicitamente documentato ("Modulo da installare SOLO sulle istanze child") come parte dell'architettura multi-tenant SaaS descritta anche in `erpv6_saas` (catalogo verticali/tenant sull'istanza "parent").

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`fetch(endpoint, params=None, cache_key=None, ttl_hours=24, category=None)`** su `erpv6.parent.client` — è l'unico metodo pensato per essere chiamato da altri moduli (client, non un modello dati). **Nessun chiamante trovato in tutto il repo**: né `erpv6_setup_wizard` (che secondo la stessa descrizione "installare solo su istanze child" sarebbe il candidato naturale) né nessun altro modulo lo referenzia. È codice morto allo stato attuale.
- **Bug reale nel codice, mai emerso perché il metodo non è mai chiamato**: `parent_client.py` importa solo `from odoo import models, api, _` (riga 1) — **manca `fields`** nell'import. Alla riga 101, nel path di "cache MISS" (chiamata HTTP riuscita), il codice esegue `'fetched_at': fields.Datetime.now()`, che solleverebbe un `NameError: name 'fields' is not defined` non gestito. Il blocco `try/except` circostante cattura solo `requests.exceptions.RequestException`, quindi il `NameError` non verrebbe intercettato. Risultato: se questo metodo venisse effettivamente chiamato oggi, andrebbe in crash ad ogni cache-miss riuscita.

## Punti di estensione noti

- Pattern cache generico (`cache_key`/`ttl_hours`/`category`) riutilizzabile per qualsiasi endpoint del parent — coerente con l'idea di motore generico, indipendente dal contenuto scambiato.
- Configurazione via `ir.config_parameter` (`erpv6.parent_url`, `erpv6.parent_api_key`) invece di hardcoding — corretto.
- Non pertinente ai principi di orchestrazione Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.1.0.0`. Coincide col `version` nel `__manifest__.py` locale — nessun drift.
- **Modulo isolato**: nessun altro modulo nel repo chiama `erpv6.parent.client.fetch()` né referenzia `erpv6.parent.cache`. Installato ma non integrato nel flusso applicativo.
- Dipende solo da `base` ed `erpv6_core`; dichiara la dipendenza Python esterna `requests` esplicitamente nel manifest (`external_dependencies`) — corretto.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Bug critico non ancora manifestatosi solo perché il codice non è mai eseguito**: `NameError` garantito su `fields.Datetime.now()` per import mancante (vedi sopra). Va corretto prima che qualunque modulo inizi a usare `fetch()`.
- Nessun modulo "child" (es. `erpv6_setup_wizard`) dichiara dipendenza da questo modulo né lo usa, nonostante la descrizione del modulo stesso lo presenti come infrastruttura da installare sulle istanze child insieme al setup wizard — il collegamento architetturale è dichiarato solo in prosa, non nel codice.
- Nessun test automatico.
