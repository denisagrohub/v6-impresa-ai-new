# Proposte di fix — 11 controller gateway rimasti (bloccati / codice morto)

**Data**: 2026-08-13
**Stato**: lavoro in corso, salvataggio incrementale — un controller alla volta, commit dopo ognuno.
**Tipo**: Solo proposta di correzione (codice completo nel documento). Nessuna modifica applicata ai controller reali, nessuna promozione in `/opt/erpv6/custom-addons`.

Contesto: prosegue l'audit di `docs/gateway-promotion-readiness-2026-08-13.md` (14 controller mai promossi). Di quei 14: `file_api.py`/`user_api.py` già promossi oggi, `tracking_api.py` promosso oggi separatamente (vedi commit `5daea8a` — l'audit lo dava per "pulito" ma conteneva in realtà il bug hasattr, corretto). Restano questi 11, qui solo analizzati e proposti, non applicati:

## Indice

1. [x] `accounting_api.py` — bug hasattr (nessuna dipendenza mancante)
2. [x] `bandi_api.py` — bug hasattr + `erpv6_bandi` non in depends
3. [ ] `methodology_api.py` — bug hasattr + `erpv6_methodology` non in depends
4. [ ] `saas_tenant_api.py` — bug hasattr (dipendenza già ok)
5. [ ] `saas_vertical_api.py` — bug hasattr + rotta duplicata con `saas_api.py`
6. [ ] `validation_api.py` — bug hasattr + `erpv6_validation` non in depends
7. [ ] `library_api.py` — bug hasattr + `erpv6_library` non in depends + campo `file_id` inesistente
8. [ ] `partner_api.py` — modello `ateco.at` inesistente + campi `ateco_code`/`fiscal_regime` inesistenti
9. [ ] `project_api.py` — `crm.lead.contact_email` inesistente (crash 500) + bug hasattr parziale
10. [ ] `saas_api.py` — dipendenza circolare di manifest (decisione di design, non solo fix meccanico)
11. [ ] `sign_api.py` — bug hasattr + `erpv6_sign` non in depends + 6 mismatch di campo/comodel

Ogni voce sopra viene marcata `[x]` e la sezione corrispondente viene aggiunta in append qui sotto, subito dopo aver completato l'analisi di quel controller — mai tutte insieme alla fine.

---

## 1. `accounting_api.py`

**Verdetto**: solo bug hasattr, nessun altro problema. `erpv6_accounting` è raggiungibile transitivamente (`erpv6_api_gateway` → `erpv6_tracking` → `erpv6_accounting`, verificato in `odoo-modules/erpv6_tracking/__manifest__.py`), quindi nessuna dipendenza da aggiungere.

**Verifica indipendente eseguita** (non solo fidandosi dell'audit del 13/08, che su `tracking_api.py` si è rivelato sbagliato): confrontati tutti i campi usati dal controller contro `odoo-modules/erpv6_accounting/models/fiscal_prediction.py`, `deduction_suggestion.py`, `asset_advisor.py` — `date`, `fiscal_year`, `revenue_ytd`, `revenue_forecast`, `predicted_iva/ires/irap/total`, `potential_savings`, `optimized_total`, `savings_percentage`, `kairos_score`, `kairos_level`, `category`, `max_deductible`, `current_in_stock`, `suggested_purchase`, `tax_savings`, `priority`, `stock_quantity`, `deduction_rate`, `deadline`, `status`, `name`, `purchase_value`, `current_value`, `net_value`, `accumulated_depreciation`, `annual_depreciation`, `eligible_bandis`, `bandi_potential_credit`, `bandi_details`, `suggested_purchase_date` — tutti esistono con lo stesso nome. Metodo `action_calculate()` confermato su `fiscal_prediction.py:147`.

**4 occorrenze del bug hasattr** (righe 23, 81, 125, 172 del file dev):

```python
if not hasattr(request.env, 'erpv6.fiscal.prediction'):
if not hasattr(request.env, 'erpv6.deduction.suggestion'):
if not hasattr(request.env, 'erpv6.asset.advisor'):
if not hasattr(request.env, 'erpv6.fiscal.prediction'):  # in get_accounting_dashboard
```

**Fix proposto** (stesso pattern usato per `tracking_api.py`, commit `5daea8a`): sostituire ciascuna con l'operatore `in` su `request.env`, che usa correttamente `Environment.__contains__`:

```python
if 'erpv6.fiscal.prediction' not in request.env:
if 'erpv6.deduction.suggestion' not in request.env:
if 'erpv6.asset.advisor' not in request.env:
if 'erpv6.fiscal.prediction' not in request.env:  # in get_accounting_dashboard
```

**Passo successivo per la promozione** (non eseguito qui): agganciare `from . import accounting_api` in `controllers/__init__.py`, copiare il file corretto in prod, verificare con update reale + chiamata HTTP autenticata (stesso metodo di `tracking_api.py`).

---

## 2. `bandi_api.py`

**Verdetto**: 2 problemi distinti, entrambi da correggere insieme.

**Verifica indipendente eseguita**: campi confrontati contro `odoo-modules/erpv6_bandi/models/bando.py`, `bando_match.py`, `bando_application.py` — `name`, `code`, `ente`, `importo_max`, `scadenza_domanda`, `tipo_agevolazione`, `match_count`, `status`, `bando_id`, `partner_id`, `project_id`, `eligibility_score`, `eligibility_level`, `motivi_compatibilita`, `motivi_esclusione`, `importo_stimato`, `consultant_id`, `deadline_interna`, `match_id`, `application_date`, `reference_number`, `amount_requested`, `funded_amount` — tutti esistono con lo stesso nome. Il valore `'draft'` passato in `create()` da `create_application()` è valido per la `Selection` di `erpv6.bando.application.status` (verificato in `bando_application.py:21-28`). Nessun mismatch di campo/valore trovato: il codice sotto la guardia hasattr è corretto.

### Problema 1 — bug hasattr (5 occorrenze: righe 23, 67, 116, 155, 200)

```python
if not hasattr(request.env, 'erpv6.bando'):              # riga 23, get_active_bandi
if not hasattr(request.env, 'erpv6.bando.match'):         # riga 67, get_bandi_match
if not hasattr(request.env, 'erpv6.bando.application'):   # riga 116, get_applications_list
if not hasattr(request.env, 'erpv6.bando.application'):   # riga 155, create_application
if not hasattr(request.env, 'erpv6.bando'):               # riga 200, get_bandi_dashboard
```

**Fix proposto**:

```python
if 'erpv6.bando' not in request.env:
if 'erpv6.bando.match' not in request.env:
if 'erpv6.bando.application' not in request.env:
if 'erpv6.bando.application' not in request.env:
if 'erpv6.bando' not in request.env:
```

### Problema 2 — `erpv6_bandi` non è dependency di `erpv6_api_gateway`

Verificato che nessun modulo nella catena di dipendenze di `erpv6_api_gateway` (né dev né prod) porta `erpv6_bandi` transitivamente: `grep -rl "erpv6_bandi" odoo-modules/*/__manifest__.py` trova solo `erpv6_package` ed `erpv6_typst` come dipendenti di `erpv6_bandi` — nessuno dei due è a sua volta dependency di `erpv6_api_gateway`. Se `erpv6_bandi` non fosse già installato indipendentemente sul DB target, `request.env['erpv6.bando']` solleverebbe `KeyError`.

**Fix proposto** — aggiungere `'erpv6_bandi'` ai `depends` di **entrambi** i manifest:

`odoo-modules/erpv6_api_gateway/__manifest__.py`:
```python
    'depends': [
        'base', 'web', 'mail', 'crm',
        'erpv6_core', 'erpv6_kb', 'erpv6_booking',
        'erpv6_consulting', 'erpv6_tracking',
        'erpv6_omni_bridge',
        'erpv6_saas',
        'erpv6_bandi',  # nuovo — richiesto da bandi_api.py
    ],
```

`/opt/erpv6/custom-addons/erpv6_api_gateway/__manifest__.py` (prod):
```python
    'depends': ['base', 'web', 'mail', 'crm', 'erpv6_core', 'erpv6_kb', 'erpv6_booking', 'erpv6_consulting', 'erpv6_tracking', 'erpv6_bandi'],
```

**Nota per chi promuoverà**: `erpv6_bandi` deve già essere installato sul DB target (staging `erpv6`) prima di aggiungere questa dependency e aggiornare `erpv6_api_gateway`, altrimenti Odoo tenterebbe di installarlo insieme — verificare lo stato con `SELECT state FROM ir_module_module WHERE name='erpv6_bandi';` prima di procedere.

---
