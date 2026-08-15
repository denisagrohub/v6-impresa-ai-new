# erpv6_integrity — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.integrity.check` | `name` (default 'Integrity Check'), `active`, `last_check`, `status` (Selection: ok/warning/error, con emoji nei label), `details` | Modello unico e minimale del modulo. Un solo record di stato, aggiornato in place ad ogni verifica |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `check_integrity()` (decorato `@api.model`) — richiamabile da bottone UI (`type="object"`, verificato in `views/integrity_views.xml`: `<button name="check_integrity" type="object" .../>`) ed effettivamente richiamato anche da un cron giornaliero (`erpv6_integrity/data/cron_data.xml`: `model.check_integrity()`, ogni 1 giorno).
- La logica interna verifica solo che 3 moduli critici (`erpv6_core`, `erpv6_crypto`, `erpv6_kb`) risultino `state='installed'` in `ir.module.module` — **nessuna verifica di firma/hash dei file manifest**, nonostante il nome del modulo e un commento nel codice stesso lo preveda come possibile estensione futura (`# Qui puoi aggiungere la logica di verifica firma se hai i file manifest`).
- `_log_result(status, details)` è privato (prefisso `_`), non pensato per l'esterno.
- **Nessun altro modulo nel repo chiama `erpv6.integrity.check` o `check_integrity()`** (grep incrociato: zero occorrenze fuori dal modulo) — è un motore isolato, autosufficiente, non orchestrato da altri componenti.

## Punti di estensione noti

- La lista `critical_modules = ['erpv6_core', 'erpv6_crypto', 'erpv6_kb']` è **hardcoded nel codice**, non configurabile da UI o da parametro — per aggiungere un quarto modulo critico da monitorare serve una modifica al codice, non è un dato.
- Il modulo ha un commento esplicito che descrive la sua stessa incompletezza (verifica firma manifest prevista ma non implementata) — coerente con la regola anti-allucinazione del CLAUDE.md: qui è il codice stesso a segnalare la lacuna, non serve inventare nulla.
- Non pertinente al modulo: nessun collegamento con i principi CLAUDE.md su kaizen/opportunity/bandi/validation — è un motore trasversale di monitoraggio infrastrutturale, non di conoscenza di settore.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_integrity` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) coincide con la versione installata: nessun drift rilevato.
- **Nessun modulo dichiara `erpv6_integrity` come dipendenza** (grep su tutti i manifest: zero risultati) — è una foglia isolata nell'albero delle dipendenze, coerente col fatto che nessun altro modulo lo richiama nel codice.
- Cron attivo e realmente configurato (verifica giornaliera).
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- La feature principale suggerita dal nome del modulo (verifica integrità/firma dei moduli) **non è implementata** — il codice attuale fa solo un controllo di presenza/stato di 3 moduli in `ir.module.module`, non una vera verifica crittografica di integrità. Questo è dichiarato nel codice stesso (commento), non un'illazione di questa analisi.
- Lista moduli critici hardcoded, non estendibile senza modifica al codice.
- Nessun test automatico.
- Un solo record di stato: se in futuro serve uno storico delle verifiche (non solo l'ultima), servirebbe un cambio di modello (attualmente ogni check sovrascrive lo stesso record via `write`, non crea nuove righe) — comportamento verificato nel codice: `_log_result` fa `self.ensure_one()` e `self.write(...)`, quindi opera sempre sul record chiamante, non ne crea uno nuovo. Il commento nel codice segnala che questo è stato un fix intenzionale rispetto a una versione precedente che aggiornava erroneamente tutti i record con `search([])`.
