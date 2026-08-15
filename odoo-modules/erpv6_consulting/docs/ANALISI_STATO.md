# erpv6_consulting — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.consulting.brand` | `name`, `code` (univoco), `active`, `color`, `default_hourly_rate`, `default_commission_rate`, `description`, `consultant_ids` (One2many), `consultant_count` (compute) | Anagrafica brand di consulenza, con default propagati ai consulenti |
| `erpv6.consulting.consultant` | `partner_id` (Many2one res.partner), `brand_id`, `hourly_rate`, `commission_rate`, `is_active`, `fiscal_code`, `vat_number`, `zone`, `languages`, `specialties`, `conversion_rate` | Anagrafica consulente. Nessuna logica di business oltre l'onchange descritto sotto |

Nessuno dei due modelli ha logica di calcolo complessa: sono sostanzialmente anagrafiche con un default automatico (onchange) e un contatore.

## Metodi pubblici pensati per essere chiamati da altri moduli

- Non esistono metodi pubblici (non `_prefissati`) espliciti oltre ai compute/onchange standard Odoo (`_compute_consultant_count`, `_onchange_brand_id`), che sono infrastruttura interna, non API pensate per altri moduli.
- Il modulo viene consumato da **altri moduli tramite riferimento diretto ai campi**, non tramite metodi: `erpv6_booking/models/booking_wizard.py` e `erpv6_booking/models/booking_token.py` leggono `erpv6.consulting.brand`/`consultant`; `erpv6_kb/models/kb_knowledge.py` ha un campo `brand_id` (Many2one a `erpv6.consulting.brand`) per associare contenuti KB a un brand.
- `erpv6_api_gateway`, `erpv6_bandi`, `erpv6_tracking`, `erpv6_typst` dichiarano `erpv6_consulting` come dipendenza nel manifest ma non ho trovato, con grep, riferimenti diretti a `erpv6.consulting.*` nel loro codice Python: la dipendenza potrebbe essere ereditata transitivamente (es. tramite `erpv6_kb`, che a sua volta dipende da `erpv6_consulting`) piuttosto che un uso diretto. Dato mancante: non è chiaro se questi 4 moduli la richiedano davvero o se sia una dipendenza superflua — da verificare caso per caso, non lo dichiaro con certezza.

## Punti di estensione noti

- `default_hourly_rate`/`default_commission_rate` sul brand, propagati via onchange al consulente solo se il campo è vuoto: pattern di default "morbido", non vincolante — un consulente può sempre avere valori diversi dal brand.
- Non ci sono Selection hardcoded né riferimenti a verticali specifici: il modulo è genuinamente generico (anagrafica trasversale), coerente col principio motore/conoscenza del CLAUDE.md — qui non c'è "motore" in senso stretto (nessun calcolo/euristica), solo dati strutturati.
- Non pertinente al modulo: le regole su erpv6_kaizen/erpv6_opportunity/erpv6_validation del CLAUDE.md non hanno alcun punto di contatto con questo modulo.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_methodology`-style check → `erpv6_consulting` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) **coincide** con la versione installata sul VPS: nessun drift rilevato.
- Il modulo carica un file `data/default_brands.xml` in installazione (dichiarato nel manifest) — non l'ho ispezionato in dettaglio, ma la sua presenza suggerisce che almeno alcuni brand di default vengano creati automaticamente all'installazione (a differenza di `erpv6_methodology`, qui potrebbero quindi esserci righe reali anche senza uso manuale — non l'ho verificato con una query DB, come da istruzioni per questo batch).
- Nessuna cartella `tests/`.
- Consumato concretamente da `erpv6_booking` e `erpv6_kb` (riferimenti diretti nel codice), oltre a comparire come dipendenza dichiarata (ma non necessariamente usata) in `erpv6_api_gateway`, `erpv6_bandi`, `erpv6_tracking`, `erpv6_typst`.

### Debiti noti / TODO

- Nessun test automatico.
- Nessun vincolo di validazione su `fiscal_code`/`vat_number` (nessun `@api.constrains`): campi liberi senza controllo di formato.
- Non è chiaro (dato mancante, non verificato) se le 4 dipendenze dichiarate ma non referenziate direttamente nel codice (`erpv6_api_gateway`, `erpv6_bandi`, `erpv6_tracking`, `erpv6_typst`) siano dipendenze reali o solo ereditate/superflue.
