# erpv6_tracking — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.tracking.config` | `name`, `code` (univoco), `active`, `use_definitive_lot`, `use_batch_lot`, `company_code` (sigla 3 lettere), `default_brand`, `use_julian_day`, `include_time`, `tracking_types` (Selection: product/document/project/order/custom), `ateco_suggested_ids` (Many2many `erpv6.ateco.regime`) | Configurazione con logica reale di lookup (`get_default_config`, `get_config_for_ateco`) |
| `erpv6.tracking.lot` | `name`, `code` (univoco), `tracking_type` (batch/definitive), `parent_lot_id`/`child_lot_ids` (gerarchia batch→definitivo), `config_id`, `company_code`, `brand_code`, `production_date`, `year`, `julian_day`, `hour`, `minute`, `quantity`, `state` (draft/active/closed/cancelled) | Modello operativo con generazione codici lotto reale |
| `erpv6.tracking.mixin` (AbstractModel) | `tracking_lot_ids`, `batch_lot_id`, `definitive_lot_id`, `tracking_enabled` | Mixin riusabile da altri modelli — **contiene un bug verificato, vedi sotto** |
| `res.config.settings` (estensione) | 5 booleani `tracking_enabled_*` collegati a `config_parameter` | Solo impostazioni di sistema |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.tracking.config.get_default_config(tracking_type)` e `get_config_for_ateco(ateco_code)`: metodi `@api.model` pensati per essere chiamati da altri moduli per ottenere la configurazione di tracciamento corretta.
- `erpv6.tracking.lot.create_batch_lot(config_id, quantity=1.0, notes=None)` e `create_definitive_lot(config_id, batch_lot_id=None, quantity=1.0, notes=None)`: metodi `@api.model` per creare lotti con codice generato automaticamente.
- `erpv6.tracking.mixin.action_create_batch_lot(config_code='product')` e `action_create_definitive_lot(config_code='product')`: pensati per essere ereditati da modelli che vogliono tracciabilità.
- **Bug reale verificato**: entrambi i metodi del mixin chiamano `self.env['erpv6.tracking.lot'].create_batch_lot(config_id=..., product_id=self.product_id.id ..., quantity=..., notes=...)` passando un parametro `product_id`, ma la firma reale di `create_batch_lot` in `tracking_lot.py` è `(self, config_id, quantity=1.0, notes=None)` — **non accetta `product_id`**. Stessa incoerenza per `create_definitive_lot` (firma reale: `config_id, batch_lot_id=None, quantity=1.0, notes=None`). Qualsiasi chiamata a questi due metodi del mixin solleverà un `TypeError` a runtime.
- **Il mixin è effettivamente usato**: `erpv6_library/models/library_document.py` fa `_inherit = ['erpv6.tracking.mixin']` — eredita i campi e i metodi bacati. Non ho trovato, nel codice attuale, punti che invocano esplicitamente `action_create_batch_lot`/`action_create_definitive_lot` da `erpv6_library` o da viste (nessun bottone trovato), quindi il bug è presente ma non necessariamente già esercitato in produzione.

## Punti di estensione noti

- Pattern mixin (`erpv6.tracking.mixin`) è il vero punto di estensione trasversale: qualsiasi modello di qualsiasi verticale può ereditarlo per ottenere tracciabilità lotti, coerente col principio motore a-settoriale.
- `tracking_types` è una Selection con 5 valori hardcoded (`product/document/project/order/custom`) — l'ultimo valore `custom` è pensato come via di fuga generica, ma resta comunque un elenco chiuso nel codice, non un campo libero.
- Collegamento a `erpv6.ateco.regime` (definito in `erpv6_accounting`) per suggerire configurazioni in base al codice ATECO — punto di integrazione reale e coerente con le dipendenze dichiarate nel manifest (`erpv6_consulting`, `erpv6_accounting`).
- Non pertinente ai principi Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`, `latest_version: 18.0.1.0.0` — coincide con `version` nel `__manifest__.py` locale. Nessun drift.
- `security/ir.model.access.csv` definisce regole di accesso **solo per `erpv6.tracking.lot`** (user + manager). **`erpv6.tracking.config` non ha nessuna riga di accesso** — un utente normale non potrà leggere/scrivere le configurazioni di tracciamento tramite ORM standard (richiede `sudo()`), il che è probabilmente non intenzionale dato che `get_default_config`/`get_config_for_ateco` sono pensati per essere invocati anche in contesto utente normale da altri modelli.
- Modulo consumato da `erpv6_library` (eredita il mixin) e referenziato nel manifest di `erpv6_api_gateway` — verificato con grep sui manifest.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Bug bloccante nel mixin**: `action_create_batch_lot`/`action_create_definitive_lot` passano `product_id` a metodi che non lo accettano — `TypeError` garantito se invocati (vedi sopra).
- Regola di accesso mancante per `erpv6.tracking.config` nel CSV di sicurezza.
- Nessun test automatico.
- Nessuna vista/menu dedicati trovati per innescare manualmente la creazione di lotti dall'UI (le viste esistenti — `tracking_views.xml`, non lette riga per riga in questa analisi — andrebbero verificate separatamente per capire se espongono bottoni collegati ai metodi bacati del mixin).
