# erpv6_accounting — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| Estensione `account.move` | `v6_predicted_tax_impact`, `v6_net_after_tax`, `v6_is_deductible`, `v6_deduction_rate`, `v6_tax_savings` (tutti compute su `amount_total`/`move_type`), `v6_sal_number`, `v6_project_id` | Logica reale: stima tasse su fatture emesse/ricevute con aliquote hardcoded (IRES 24%, IRAP 3.9%) |
| `erpv6.asset.advisor` | `name`, `category` (Selection 7 valori), `purchase_value`, `net_value`/`annual_depreciation` (compute), `eligible_bandis`/`bandi_potential_credit`/`bandi_details` (compute, regole hardcoded su Credito 4.0/5.0/Sabatini) | Logica di business reale ma con percentuali fiscali hardcoded nel codice Python |
| `erpv6.ateco.regime` | `code` (unique), `regime_default` (Selection 4 regimi), `coefficiente_redditivita`, `aliquota_iva_media`, `settore` | Anagrafica con un metodo di lookup pubblico (`get_regime_for_ateco`) |
| `erpv6.deduction.suggestion` | `category` (Selection 13 valori), `max_deductible`, `current_in_stock`, `suggested_purchase`/`tax_savings` (compute), `stock_product_ids`/`stock_quantity`/`stock_value` (compute, cerca in `product.product`) | Logica reale di match inventario↔deduzioni fiscali |
| `erpv6.fiscal.prediction` | Dati fatturato/costi YTD e forecast, `predicted_iva/ires/irap/regional/total` (compute), `potential_savings`, `kairos_score`/`kairos_level` (compute, **vedi debiti**), `state` (draft/calculated/confirmed) | Modello con più logica del modulo, `action_calculate()` aggrega dati reali da `account.move` |
| Estensione `res.partner` | `v6_ateco_code`, `v6_fiscal_regime`, `v6_coefficiente_redditivita`, `v6_predicted_annual_tax` (compute), `v6_kairos_score`/`v6_kairos_level` (compute, **vedi debiti**) | Duplica parzialmente la logica Kairós di `erpv6.fiscal.prediction` |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`erpv6.ateco.regime.get_regime_for_ateco(ateco_code)`** (`@api.model`): unico vero metodo di lookup pensato per riuso — cerca match esatto poi prefisso a 5 caratteri, fallback `'ordinario'`. Richiamato solo internamente (`_onchange_ateco_code` in `res_partner.py`), nessun altro modulo lo chiama.
- **`action_calculate()`** su `erpv6.fiscal.prediction`: il metodo più corposo del modulo, calcola tutte le previsioni fiscali da dati reali (`account.move` filtrate per company/anno). Chiamato da bottone UI e dal controller `accounting_api.py` (se non esiste una prediction, la crea e la calcola al volo).
- **`action_create_purchase_order()`** su `erpv6.deduction.suggestion`, **`action_check_bandi_eligibility()`** su `erpv6.asset.advisor`: solo UI.
- **Nessun modulo esterno chiama direttamente questi modelli/metodi in Python** — l'unico consumer è `erpv6_api_gateway/controllers/accounting_api.py` (endpoint `/api/v1/accounting/*`, non letto in dettaglio in questo batch ma verificato che referenzia questi modelli).

## Punti di estensione noti

- **Violazione concreta del principio motore/conoscenza del CLAUDE.md**: il modulo implementa una propria logica "Kairós Finanziario" (campi `kairos_score`/`kairos_level` su `erpv6.fiscal.prediction`, e `v6_kairos_score`/`v6_kairos_level` su `res.partner`) **completamente separata e duplicata** rispetto al motore generico `erpv6.kairos.matrix` già presente in `erpv6_methodology`, che ha esplicitamente un `matrix_type='finanziario'` chiamato **"Matrice Finanziabilità x Prontezza"** — pensato esattamente per questo caso d'uso, con 5 indicatori generici (1-3 ciascuno) e soglie 5-15/basso-medio-alto identiche nella struttura. `erpv6_accounting` non dipende da `erpv6_methodology` (non è nel manifest) e reimplementa da zero una formula diversa (punteggio base 10 + bonus su margine, invece dei 5 indicatori generici). Questo è esattamente il tipo di duplicazione "motore in nuovo codice invece di conoscenza in erpv6_kb" che il CLAUDE.md vieta esplicitamente.
- **Discrepanza manifest/codice**: la descrizione nel manifest dichiara "Integrazione con erpv6_kb per regole fiscali cifrate", ma `erpv6_kb` **non è nemmeno nel `depends`** del manifest, e non c'è nessuna riga di codice in tutto il modulo che referenzia `erpv6.kb` o `erpv6_kb`. Le regole fiscali (aliquote IRES 24%, IRAP 3.9%, coefficienti forfettario, percentuali Credito 4.0/5.0) sono tutte **hardcoded direttamente nel codice Python** (`account_move.py`, `asset_advisor.py`, `fiscal_prediction.py`, `res_partner.py`) — l'esatto contrario del principio "conoscenza di settore va in erpv6_kb, non nel codice del motore".
- `category` su `erpv6.deduction.suggestion` è Selection hardcoded (13 valori) — non estendibile senza modifica codice, ma trattandosi di categorie fiscali italiane specifiche (non un motore a-settoriale) è una scelta difendibile.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.1.0.0`. Coincide con la versione nel manifest locale — nessun drift.
- Consumer esterno reale: `erpv6_api_gateway/controllers/accounting_api.py` espone `/api/v1/accounting/*`; il modulo ha anche un proprio controller interno `/api/v6/accounting/*` (stesso pattern di duplicazione di superficie API già osservato in `erpv6_bandi`).
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Duplicazione architetturale del motore Kairós** (vedi sopra) — il debito più rilevante trovato in questo modulo.
- Aliquote fiscali hardcoded nel codice Python invece che in `erpv6_kb` (vedi sopra) — se un'aliquota cambia (es. IRES), richiede una modifica di codice e una promozione del modulo invece di un aggiornamento dati.
- Due superfici API parallele (`/api/v6/accounting/*` interno e `/api/v1/accounting/*` nel gateway) con lo stesso pattern di incoerenza già visto in `erpv6_bandi`.
- Nessun test automatico.
- Le stime fiscali (es. `profit_estimate = move.amount_untaxed * 0.4` in `account_move.py`) sono euristiche molto semplificate (percentuale fissa di utile sul fatturato) — non validate contro casi reali, nessun test che ne verifichi la correttezza contabile.
