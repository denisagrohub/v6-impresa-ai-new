# erpv6_contract — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.contract` | `name`, `partner_id`, `project_id` (Many2one `project.project`), `package_id` (Many2one `erpv6.package.custom`), `document_ids` (One2many), `status` (Selection: draft/sent/signed/certified/expired), `signed_at`, `signature_hash`, `blockchain_hash`, `is_certified` | Eredita `mail.thread` e `mail.activity.mixin` (tracking attivo sui campi principali). Nessun metodo custom: solo campi e stato |
| `erpv6.contract.document` | `name`, `contract_id`, `doc_type` (Selection: nda/service/terms/privacy/custom), `content` (Binary), `file_name`, `hash`, `signed_by`, `signed_at`, `signature_hash`, `blockchain_hash`, `is_certified` | Documento allegato al contratto. Nessuna logica di business nel modulo stesso |

Entrambi i modelli sono puramente anagrafici/di stato: tutta la logica di business (calcolo hash, firma, certificazione blockchain) **non è implementata qui**, ma è delegata ad altri moduli (vedi sotto).

## Metodi pubblici pensati per essere chiamati da altri moduli

- **Nessun metodo pubblico definito in questo modulo.** Non ho trovato alcuna funzione non `_prefissata` nei due model file, né logica di calcolo per `signature_hash`/`blockchain_hash`/`is_certified` — questi campi esistono come contenitori di stato ma nulla nel modulo li valorizza.
- Il modulo è **consumato** da `erpv6_sign/models/sign_request.py`, che referenzia `erpv6.contract` — è quindi `erpv6_sign` (dipendenza dichiarata su `erpv6_contract`) a scrivere presumibilmente su questi campi, non il contrario. Non ho letto il codice di `erpv6_sign` in dettaglio (fuori scope per questo batch): dato da verificare se serve conferma di come vengono effettivamente popolati `signature_hash`/`blockchain_hash`.
- `package_id` collega il contratto a `erpv6.package.custom` (dipendenza dichiarata su `erpv6_package`), ma non ho trovato codice in questo modulo che legga/scriva quel campo oltre alla definizione — sembra un semplice link di riferimento.

## Punti di estensione noti

- `doc_type` su `erpv6.contract.document` è una Selection con 5 valori hardcoded (`nda`, `service`, `terms`, `privacy`, `custom`) — l'ultimo valore `custom` suggerisce un tentativo di estensibilità ma resta comunque un campo chiuso, non un Char libero.
- `status` su `erpv6.contract` è anch'esso Selection hardcoded (5 stati) — coerente con un workflow a stati finiti, ragionevole per un contratto (non è un caso di "conoscenza di verticale" da rendere dinamica).
- Non pertinente al modulo: i principi CLAUDE.md su erpv6_kaizen/erpv6_opportunity/erpv6_bandi/erpv6_validation non toccano questo modulo, che è un motore trasversale di gestione contratti (non manipola conoscenza di settore).

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_contract` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) coincide con la versione installata: nessun drift rilevato.
- Consumo reale confermato solo da `erpv6_sign` (unico modulo che dichiara `erpv6_contract` in `depends` e referenzia `erpv6.contract` nel codice).
- Nessuna cartella `tests/`.
- Nessun controller API in `erpv6_api_gateway` espone `erpv6.contract`/`erpv6.contract.document` (verificato con grep incrociato — non trovato nulla in `erpv6_api_gateway/controllers/`): il modulo non è raggiungibile da frontend via REST, solo via UI Odoo o da `erpv6_sign`.

### Debiti noti / TODO

- I campi `signature_hash`, `blockchain_hash`, `is_certified` sono definiti ma **senza alcuna logica di calcolo/validazione in questo modulo** — il rischio è che restino sempre vuoti/falsi se `erpv6_sign` non li popola correttamente (non verificato, fuori scope).
- Nessun `@api.constrains` sul modulo: ad esempio nessun controllo che uno stato `signed`/`certified` richieda effettivamente `signed_at`/`signature_hash` valorizzati — possibile incoerenza di stato non impedita a livello di modello.
- Nessun test automatico.
- Nessuna esposizione via API gateway.
