# Proposte di fix — 11 controller gateway rimasti (bloccati / codice morto)

**Data**: 2026-08-13
**Stato**: lavoro in corso, salvataggio incrementale — un controller alla volta, commit dopo ognuno.
**Tipo**: Solo proposta di correzione (codice completo nel documento). Nessuna modifica applicata ai controller reali, nessuna promozione in `/opt/erpv6/custom-addons`.

Contesto: prosegue l'audit di `docs/gateway-promotion-readiness-2026-08-13.md` (14 controller mai promossi). Di quei 14: `file_api.py`/`user_api.py` già promossi oggi, `tracking_api.py` promosso oggi separatamente (vedi commit `5daea8a` — l'audit lo dava per "pulito" ma conteneva in realtà il bug hasattr, corretto). Restano questi 11, qui solo analizzati e proposti, non applicati:

## Indice

1. [x] `accounting_api.py` — bug hasattr (nessuna dipendenza mancante)
2. [x] `bandi_api.py` — bug hasattr + `erpv6_bandi` non in depends
3. [x] `methodology_api.py` — bug hasattr + `erpv6_methodology` non in depends
4. [x] `saas_tenant_api.py` — bug hasattr + dipendenza circolare `erpv6_saas`↔`erpv6_api_gateway` (non "già ok" come diceva l'audit precedente)
5. [x] `saas_vertical_api.py` — rotte duplicate di `saas_api.py`: proposta di rimozione, non di fix
6. [x] `validation_api.py` — bug hasattr + `erpv6_validation` non in depends
7. [x] `library_api.py` — bug hasattr + `erpv6_library` non in depends + campo `file_id` inesistente (fix architetturale, non solo rename)
8. [x] `partner_api.py` — modello `ateco.at` inesistente + campi `ateco_code`/`fiscal_regime` inesistenti
9. [x] `project_api.py` — `crm.lead.contact_email` inesistente (crash 500) + bug hasattr parziale
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

## 3. `methodology_api.py`

**Verdetto**: 2 problemi, stesso schema di `bandi_api.py`. È il controller più esteso dei 14 (12 occorrenze del bug hasattr su 4 modelli — Pareto, Kairós, 5S, Heinrich).

**Verifica indipendente eseguita**: tutti i campi confrontati contro `odoo-modules/erpv6_methodology/models/pareto_analysis.py`, `pareto_item.py`, `kairos_matrix.py`, `matrix5s_assessment.py`, `matrix5s_line.py`, `heinrich_indicator.py` — `name`, `res_model`, `res_id`, `total_score`, `priority_count`, `notes`, `item_ids`, `frequenza`, `impatto`, `punteggio`, `cumulata_pct`, `is_priority`, `matrix_type`, `impatto_score`, `impatto_level`, `indicatore_1..5`, `prontezza_totale`, `prontezza_level`, `quadrante`, `assessment_date`, `area`, `line_ids`, `fase`, `azione_tipica`, `spreco_identificato`, `guadagno_potenziale`, `near_miss_segnalati`, `problemi_lievi`, `eventi_gravi`, `cultura_organizzativa`, `note` — tutti esistono con lo stesso nome. Metodo `compute_pareto()` confermato su `pareto_analysis.py:23`.

**Osservazione minore, non bloccante**: `res_model` e `res_id` sono `required=True` su tutti e 4 i modelli, ma `create_pareto_analysis`, `create_kairos_matrix`, `create_5s_assessment` e `create_heinrich_indicator` li leggono con `data.get('res_model', '')` / `data.get('res_id', 0)` — se il chiamante li omette, il record viene creato con `res_model=''`/`res_id=0` invece che fallire con un errore chiaro (dipende dalla versione del vincolo NOT NULL se questo passa silenziosamente o solleva `IntegrityError`; non verificato a runtime in questa fase, segnalato solo come rischio di qualità dati). Non è un blocco per la promozione, ma andrebbe validato esplicitamente (`if not res_model or not res_id: return 400`) in un secondo passaggio.

### Problema 1 — bug hasattr (12 occorrenze)

```python
# Pareto (righe 25, 100, 151, 191)
if not hasattr(request.env, 'erpv6.pareto.analysis'):
# Kairós (righe 229, 269, 316)
if not hasattr(request.env, 'erpv6.kairos.matrix'):
# 5S (righe 364, 410, 456)
if not hasattr(request.env, 'erpv6.matrix5s.assessment'):
# Heinrich (righe 496, 533)
if not hasattr(request.env, 'erpv6.heinrich.indicator'):
```

**Fix proposto** — sostituire ciascuna occorrenza con la forma `in request.env`, stesso modello per tutte e 4:

```python
if 'erpv6.pareto.analysis' not in request.env:
if 'erpv6.kairos.matrix' not in request.env:
if 'erpv6.matrix5s.assessment' not in request.env:
if 'erpv6.heinrich.indicator' not in request.env:
```

### Problema 2 — `erpv6_methodology` non è dependency di nessun modulo raggiungibile

Verificato con `grep -rl "erpv6_methodology" odoo-modules/*/__manifest__.py`: **nessun risultato**. A differenza di `erpv6_bandi` (almeno referenziato da `erpv6_package`/`erpv6_typst`), `erpv6_methodology` non è depends di nessun modulo nel repo — è un motore generico (CLAUDE.md: "Pareto/Kairós/5S sono motori generici e a-settoriali, riusabili da qualsiasi verticale") pensato per essere usato via gateway, ma il gateway stesso non lo dichiara.

**Fix proposto**:

`odoo-modules/erpv6_api_gateway/__manifest__.py`:
```python
    'depends': [
        'base', 'web', 'mail', 'crm',
        'erpv6_core', 'erpv6_kb', 'erpv6_booking',
        'erpv6_consulting', 'erpv6_tracking',
        'erpv6_omni_bridge',
        'erpv6_saas',
        'erpv6_bandi',        # da fix bandi_api.py
        'erpv6_methodology',  # nuovo — richiesto da methodology_api.py
    ],
```

`/opt/erpv6/custom-addons/erpv6_api_gateway/__manifest__.py` (prod):
```python
    'depends': ['base', 'web', 'mail', 'crm', 'erpv6_core', 'erpv6_kb', 'erpv6_booking', 'erpv6_consulting', 'erpv6_tracking', 'erpv6_bandi', 'erpv6_methodology'],
```

**Nota per chi promuoverà**: come per `erpv6_bandi`, verificare `SELECT state FROM ir_module_module WHERE name='erpv6_methodology';` sul DB target prima di aggiornare il gateway.

---

## 4. `saas_tenant_api.py`

**Verdetto**: l'audit del 13/08 lo classificava "CODICE MORTO IN DEV, ma erpv6_saas già in depends dev, solo bug hasattr da correggere". **Verifica indipendente**: la seconda metà di questa affermazione è sbagliata. `erpv6_saas` è sì elencato nei `depends` del manifest dev di `erpv6_api_gateway`, ma `odoo-modules/erpv6_saas/__manifest__.py` dichiara a sua volta `'depends': [..., 'erpv6_api_gateway', ...]` — è **esattamente la stessa dipendenza circolare** già individuata per `saas_api.py` (voce #10 di questo documento), solo che l'audit precedente non l'ha collegata anche a questo controller perché si è fermato a "la dependency è elencata" senza controllare se il grafo fosse risolvibile.

**Verifica indipendente sui campi** (comunque completata, indipendentemente dal blocco di dipendenza): confrontati contro `odoo-modules/erpv6_saas/models/saas_tenant.py` e `vertical_catalog.py` — `name`, `partner_id`, `verticale`, `subscription_status`, `subscription_expires_at`, `trial_ends_at`, `setup_fee_paid`, `notes`, `active`, `module_names`, `is_active` — tutti esistono con lo stesso nome. Nessun mismatch di campo.

### Problema 1 — bug hasattr (2 occorrenze: righe 23, 79)

```python
if not hasattr(request.env, 'erpv6.saas.tenant'):  # riga 23, get_tenant_dashboard
if not hasattr(request.env, 'erpv6.saas.tenant'):  # riga 79, get_subscription_details
```

**Fix proposto**:

```python
if 'erpv6.saas.tenant' not in request.env:
if 'erpv6.saas.tenant' not in request.env:
```

### Problema 2 — dipendenza circolare `erpv6_saas` ↔ `erpv6_api_gateway` (condiviso con `saas_api.py` e `saas_vertical_api.py`)

Non risolvibile aggiungendo/rimuovendo una singola riga in un manifest: è una **decisione di design condivisa dai 3 controller SaaS** (`saas_api.py`, `saas_tenant_api.py`, `saas_vertical_api.py` — tutti e 3 usano modelli di `erpv6_saas`). Vedi la voce #10 (`saas_api.py`) per l'analisi completa delle opzioni e la proposta. Qualunque soluzione scelta lì (nuovo modulo ponte, o inversione della direzione della dipendenza) va applicata una sola volta e risolve automaticamente il blocco anche per questo controller e per `saas_vertical_api.py` — non vanno decise 3 volte separatamente.

**Nota**: questo controller resta comunque "codice morto in dev" (non importato in `__init__.py`) indipendentemente dal fix hasattr, finché il problema di dipendenza circolare non è risolto — agganciarlo oggi senza risolvere prima la #10 lo lascerebbe con lo stesso rischio di `saas_api.py` (grafo non risolvibile da Odoo al momento dell'installazione/aggiornamento).

---

## 5. `saas_vertical_api.py`

**Verdetto — diverso dagli altri**: qui la proposta non è "correggere e agganciare", ma **non agganciare affatto e valutare la rimozione del file**. Motivo: `saas_vertical_api.py` registra le stesse identiche 2 rotte di `saas_api.py` (`GET /api/v1/saas/verticals`, `GET /api/v1/saas/verticals/<string:verticale>/modules`) — confermato confrontando riga per riga i due file. `saas_api.py` è **già agganciato in `__init__.py`** (dev) da prima di questa sessione; se si agganciasse anche `saas_vertical_api.py`, Odoo registrerebbe due `@http.route` sullo stesso path, con esito che dipende dall'ordine di import in `__init__.py` (l'ultimo importato sovrascrive silenziosamente il precedente nella url map di werkzeug) — un comportamento fragile e non intenzionale, non una vera scelta.

**Confronto qualità del codice tra i due file** (rilevante per decidere quale tenere, non solo quale è già agganciato):

- `saas_api.py.get_vertical_modules` delega alla logica già presente sul modello: `request.env['erpv6.vertical.catalog'].sudo().get_modules_for_verticale(verticale)` (metodo verificato in `odoo-modules/erpv6_saas/models/vertical_catalog.py:19-32` — search + filtro `is_active` + split/trim del CSV, con log di warning se il verticale non è trovato).
- `saas_vertical_api.py.get_verticale_modules` **duplica manualmente** la stessa logica (search + filtro `is_active` + split/trim) direttamente nel controller, invece di riusare il metodo del modello.

`saas_api.py` è quindi anche la versione architetturalmente migliore (logica nel modello, non nel controller — coerente con la convenzione Odoo), oltre a essere quella già viva. Questo conferma l'ipotesi già avanzata nell'audit del 12/08 ("uno dei due file è probabilmente residuo di un refactor mai completato").

**Verifica indipendente sui campi** (comunque completata): `verticale`, `name`, `description`, `module_names`, `is_active` — tutti esistono su `erpv6.vertical.catalog`, nessun mismatch. Il bug hasattr (2 occorrenze, righe 23 e 64) sarebbe comunque presente se si decidesse di tenere il file, ma è un fix discutibile su codice da eliminare.

**Fix proposto**: eliminare `odoo-modules/erpv6_api_gateway/controllers/saas_vertical_api.py` e non aggiungerlo mai a `__init__.py`. Nessuna funzionalità persa: le stesse 2 rotte restano coperte da `saas_api.py`, che resta comunque bloccato dalla dipendenza circolare #10/#4 finché quella non si risolve — a quel punto basterà sbloccare `saas_api.py` una volta sola.

**Alternativa se si preferisce non cancellare file** (meno pulita, sconsigliata): lasciare il file nel repo ma commentarne l'eventuale futuro import con una nota esplicita del motivo, per non perdere la cronologia — la rimozione diretta resta comunque la scelta consigliata, il repo ha già git per la cronologia.

---

## 6. `validation_api.py`

**Verdetto**: stesso schema di `bandi_api.py`/`methodology_api.py` — bug hasattr + dependency mancante, ma qui **nessuna dipendenza circolare** (a differenza dei controller SaaS): `erpv6_validation` non dipende da `erpv6_api_gateway`.

**Verifica indipendente eseguita**: campi confrontati contro `odoo-modules/erpv6_validation/models/validation_session.py`, `validation_round.py`, `validation_analysis.py` — `res_model`, `res_id`, `destinatario`, `scopo`, `context_data`, `validation_mode`, `status`, `max_rounds`, `current_round_number`, `human_reviewer_id`, `human_reviewed_at`, `human_notes`, `round_ids`, `round_number`, `analysis_ids`, `issues_found`, `sesto_uomo_notes`, `corrected_material`, `analyst_index`, `findings`, `claims_checked`, `flagged_missing_data` — tutti esistono con lo stesso nome. Metodi `action_start_validation()`, `action_human_approve()`, `action_human_reject(reason=None)` confermati con la stessa firma usata dal controller. Questo controller espone anche `erpv6.validation.round` ed `erpv6.validation.analysis` (i singoli giudici) tramite `rounds_data` nel dettaglio sessione — colma quindi il gap segnalato in FASE B dell'audit del 12/08 ("il frontend può vedere lo stato della sessione ma non il dettaglio dei round"), una volta promosso.

**Osservazione minore, non bloccante**: `destinatario`, `scopo`, `context_data` sono `required=True` su `erpv6.validation.session`, ma `create_validation_session` li legge con default silenziosi (`data.get('destinatario', '')` ecc.) — stesso pattern già segnalato per `methodology_api.py`. Non blocca la promozione, ma andrebbe validato esplicitamente in un secondo passaggio.

### Problema 1 — bug hasattr (6 occorrenze: righe 23, 63, 128, 170, 205, 240)

```python
if not hasattr(request.env, 'erpv6.validation.session'):  # ripetuto identico in tutti e 6 gli endpoint
```

**Fix proposto** — stessa sostituzione in tutte e 6 le occorrenze:

```python
if 'erpv6.validation.session' not in request.env:
```

### Problema 2 — `erpv6_validation` non è dependency di nessun modulo raggiungibile

`grep -rl "erpv6_validation" odoo-modules/*/__manifest__.py` → nessun risultato, né diretta né transitiva, in nessun manifest del repo.

**Fix proposto**:

`odoo-modules/erpv6_api_gateway/__manifest__.py`:
```python
    'depends': [
        'base', 'web', 'mail', 'crm',
        'erpv6_core', 'erpv6_kb', 'erpv6_booking',
        'erpv6_consulting', 'erpv6_tracking',
        'erpv6_omni_bridge',
        'erpv6_saas',
        'erpv6_bandi',        # da fix bandi_api.py
        'erpv6_methodology',  # da fix methodology_api.py
        'erpv6_validation',   # nuovo — richiesto da validation_api.py
    ],
```

`/opt/erpv6/custom-addons/erpv6_api_gateway/__manifest__.py` (prod):
```python
    'depends': ['base', 'web', 'mail', 'crm', 'erpv6_core', 'erpv6_kb', 'erpv6_booking', 'erpv6_consulting', 'erpv6_tracking', 'erpv6_bandi', 'erpv6_methodology', 'erpv6_validation'],
```

**Nota per chi promuoverà**: verificare `SELECT state FROM ir_module_module WHERE name='erpv6_validation';` sul DB target prima di aggiornare il gateway.

---

## 7. `library_api.py`

**Verdetto**: 3 problemi. Il più interessante è il terzo — non è un semplice refuso di nome campo, è un errore di modellazione dei dati che richiede riscrivere la logica, non solo rinominare `file_id` in `file`.

**Verifica indipendente eseguita**: letto `odoo-modules/erpv6_library/models/library_document.py` per intero. Campi `project_id`, `name`, `category`, `origin`, `is_final_client_facing`, `blockchain_record_id`, `create_date` esistono tutti come atteso. **Ma il campo file è modellato diversamente da come il controller lo usa.**

### Problema 1 — bug hasattr (2 occorrenze: righe 19, 75)

```python
if not hasattr(request.env, 'erpv6.library.document'):
```
**Fix**: `if 'erpv6.library.document' not in request.env:`

### Problema 2 — `erpv6_library` non è dependency di `erpv6_api_gateway`

`grep -rl "erpv6_library" odoo-modules/*/__manifest__.py` → nessun risultato. Va aggiunto ai `depends` di entrambi i manifest, stesso pattern delle voci precedenti (`erpv6_bandi`, `erpv6_methodology`, `erpv6_validation`).

### Problema 3 — `doc.file_id` non esiste; `file` è un `Binary(attachment=True)`, non un `Many2one('ir.attachment')`

Verificato in `library_document.py:72-76`:
```python
file = fields.Binary(string='File', attachment=True, help='...')
file_name = fields.Char(string='Nome File')
```

`attachment=True` fa sì che Odoo, dietro le quinte, salvi il contenuto in un `ir.attachment` — ma il campo sul modello resta un Binary (contenuto base64), **non** una relazione Many2one navigabile. Il controller invece tratta `file` come se fosse una relazione:

- **GET** (riga 40): `doc.file_id` → `AttributeError`, il campo non esiste — non un `None`/falsy, proprio un crash.
- **POST** (righe 104-114): crea un `ir.attachment` a parte con `res_model: 'erpv6.library.document'` ma **senza `res_id`** (il documento non esiste ancora quando l'attachment viene creato) — un allegato orfano, mai davvero collegato al documento — poi tenta `vals['file_id'] = file_id` in `create()`, che fallisce con `ValueError: Invalid field 'file_id'` perché il campo non esiste sul modello.

Il fix corretto non è rinominare `file_id` in `file` nei punti dove si assegna un id — bisogna passare il contenuto binario direttamente e recuperare l'`ir.attachment` sottostante quando serve l'id per il link di download (che `file_api.py`'s `/api/v1/files/<id>/download` si aspetta essere un id di `ir.attachment`, verificato in `file_api.py:64-65`).

**Fix proposto — GET `get_project_documents`** (sostituisce le righe 37-59):

```python
            result = []
            for doc in documents:
                file_url = None
                attachment = request.env['ir.attachment'].sudo().search([
                    ('res_model', '=', 'erpv6.library.document'),
                    ('res_id', '=', doc.id),
                    ('res_field', '=', 'file'),
                ], limit=1)
                if attachment:
                    file_url = f'/api/v1/files/{attachment.id}/download'

                blockchain_record = None
                if doc.blockchain_record_id:
                    blockchain_record = {
                        'id': doc.blockchain_record_id.id,
                        'tx_hash': doc.blockchain_record_id.tx_hash if hasattr(doc.blockchain_record_id, 'tx_hash') else '',
                    }

                result.append({
                    'id': doc.id,
                    'name': doc.name or '',
                    'category': doc.category or '',
                    'origin': doc.origin or '',
                    'is_final_client_facing': doc.is_final_client_facing or False,
                    'blockchain_record': blockchain_record,
                    'create_date': doc.create_date.isoformat() if doc.create_date else None,
                    'file_url': file_url,
                })
```

Nota: ho anche tolto l'`hasattr(doc, 'blockchain_record_id')` di guardia (riga 44 originale) — `blockchain_record_id` è un campo del modello stesso (non di un modulo terzo opzionale), quindi `hasattr` sull'oggetto record ORM funziona diversamente da `hasattr(request.env, ...)` (qui è legittimo, i campi sono attributi veri sull'istanza), ma è comunque ridondante: il campo esiste sempre su ogni record di questo modello, il controllo utile è solo `doc.blockchain_record_id` (falsy se non popolato), già presente. Stesso discorso per `hasattr(doc.blockchain_record_id, 'tx_hash')`: `blockchain_record_id` punta sempre a `erpv6.blockchain.record`, che ha sempre il campo `tx_hash` — l'`hasattr` qui non protegge da nulla di reale.

**Fix proposto — POST `create_document`** (sostituisce le righe 89-127):

```python
            data = request.get_json(force=True, silent=True) or {}

            vals = {
                'name': data.get('name', 'Untitled Document'),
                'category': data.get('category', 'general'),
                'origin': data.get('origin', 'manual'),
                'project_id': project_id,
            }

            content_b64 = data.get('file_content', '')
            if content_b64:
                vals['file'] = content_b64
                vals['file_name'] = data.get('filename', 'document.pdf')

            doc = request.env['erpv6.library.document'].sudo().create(vals)

            file_url = None
            if content_b64:
                attachment = request.env['ir.attachment'].sudo().search([
                    ('res_model', '=', 'erpv6.library.document'),
                    ('res_id', '=', doc.id),
                    ('res_field', '=', 'file'),
                ], limit=1)
                if attachment:
                    file_url = f'/api/v1/files/{attachment.id}/download'

            result = {
                'id': doc.id,
                'name': doc.name,
                'category': doc.category,
                'origin': doc.origin,
                'file_url': file_url,
            }

            self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=201)
```

**Osservazione**: `category` sul modello reale è `Selection` con valori fissi (`nda`, `proposal`, `sal`, `contract`, `business_plan`, `final`, `client_upload`, `other`, `brand_logo`, `brand_asset`) e `required=True` — il controller usa `data.get('category', 'general')` come default, ma `'general'` **non è un valore valido** della Selection. Se il chiamante non passa `category`, la create() fallirebbe con un errore di validazione Selection (comportamento corretto, ma il default `'general'` scelto dal controller è comunque sbagliato e andrebbe cambiato in `'other'`, l'unico valore generico esistente).

**Fix proposto per il default**: `'category': data.get('category', 'other'),` al posto di `'category': data.get('category', 'general'),`.

---

## 8. `partner_api.py`

**Verdetto**: nessun bug hasattr qui (questo controller non usa il pattern `hasattr(request.env, ...)`), nessuna dependency mancante (`erpv6_accounting`, che estende `res.partner`, è raggiungibile via `erpv6_tracking` come già verificato per `accounting_api.py`). Il problema è di naming: due campi inventati che non esistono, più un modello inventato — e un uso scorretto di `hasattr()` sull'**oggetto record** (diverso da `hasattr(request.env, ...)`, ma qui comunque fuorviante perché nasconde il vero problema).

**Verifica indipendente eseguita**: letto `odoo-modules/erpv6_accounting/models/res_partner.py` per intero. `res.partner` **non ha** campi `ateco_code`/`fiscal_regime`. Ha invece:
- `v6_ateco_code` — `Char`, non un Many2one (contrariamente a quanto il controller assume trattandolo come un id da risolvere)
- `v6_fiscal_regime` — `Selection(['ordinario', 'semplificato', 'forfettario', 'agricolo_speciale'])`
- Il modello `ateco.at` usato in `update_partner_profile` **non esiste**; il modello reale per la ricerca/validazione codici ATECO è `erpv6.ateco.regime` (`code` Char, `regime_default` Selection — stessi valori di `v6_fiscal_regime`), verificato in `odoo-modules/erpv6_accounting/models/ateco_regime.py`.

**Perché `hasattr(partner, 'ateco_code')` non esplode ma restituisce comunque dati falsi**: qui `hasattr` è chiamato su un **record ORM** (`partner`), non su `request.env` — su un record, `hasattr` funziona correttamente in Python (verifica un attributo reale dell'istanza). Il problema non è il meccanismo `hasattr` in sé (diverso dal bug sistemico degli altri 9 controller), ma il **nome sbagliato**: `hasattr(partner, 'ateco_code')` è sempre `False` perché il campo si chiama `v6_ateco_code`, non perché il meccanismo di controllo sia rotto. Effetto pratico: la GET risponde sempre con `ateco_code`/`fiscal_regime` vuoti (mai un errore), e la PUT risponde `200` "salvato" senza scrivere mai né l'ateco né il regime — un contratto API silenziosamente falso, dello stesso tipo del bug originale in `odoo-adapter.ts` risolto in una fase precedente di questa sessione.

**Fix proposto — GET `get_partner_profile`** (sostituisce le righe 20-27):

```python
            ateco_code = partner.v6_ateco_code or ''
            fiscal_regime = partner.v6_fiscal_regime or ''
```

(elimina del tutto la necessità di `hasattr`: i campi esistono sempre su ogni `res.partner`, essendo estensioni dirette del modello via `_inherit`, non funzionalità di un modulo opzionale — la wrapping `hasattr` non serviva a nulla anche se i nomi fossero stati giusti.)

**Fix proposto — PUT `update_partner_profile`** (sostituisce le righe 90-98):

```python
            ateco_updated = False
            if 'ateco_code' in data:
                ateco_regime = request.env['erpv6.ateco.regime'].sudo().search([
                    ('code', '=', data['ateco_code'])
                ], limit=1)
                if ateco_regime:
                    update_vals = {'v6_ateco_code': ateco_regime.code}
                    # Se il chiamante non specifica esplicitamente il regime fiscale,
                    # usa il default associato al codice ATECO (stessa logica di
                    # res_partner.py:_onchange_ateco_code, riusata qui lato server).
                    if 'fiscal_regime' not in data and ateco_regime.regime_default:
                        update_vals['v6_fiscal_regime'] = ateco_regime.regime_default
                    partner.write(update_vals)
                    ateco_updated = True

            if 'fiscal_regime' in data:
                partner.write({'v6_fiscal_regime': data['fiscal_regime']})
```

E aggiornare la risposta finale (righe 117-118) per riflettere i valori realmente scritti invece di rieccheggiare l'input grezzo del chiamante:

```python
                'ateco_code': updated_partner.v6_ateco_code or '',
                'fiscal_regime': updated_partner.v6_fiscal_regime or '',
```

**Nota**: `ateco_updated` è calcolato ma non usato nella risposta — nel controller originale nemmeno lo era (già dead code prima di questo fix); lasciato per non allargare la superficie della modifica oltre il necessario, ma segnalato qui come piccola pulizia rimandabile.

---

## 9. `project_api.py`

**Verdetto**: crash garantito su ogni chiamata a `GET /api/v1/projects/<id>`, più bug hasattr solo sul conteggio documenti (`GET /api/v1/projects` senza id non è affetto).

**Verifica indipendente eseguita contro lo schema reale del database di produzione** (non solo contro il codice sorgente, come per gli altri controller — qui replico lo stesso controllo che l'audit del 13/08 dichiara di aver fatto, per confermarlo davvero): `\d crm_lead` sul DB `erpv6` conferma che esistono le colonne `contact_name`, `email_from`, `phone` — **`contact_email` non esiste**.

```
 contact_name  | character varying
 email_from    | character varying
 phone         | character varying
```

### Problema 1 — `project.contact_email` inesistente → crash 500 garantito (riga 73)

```python
'customer_email': project.contact_email or '',
```

Ogni chiamata a `GET /api/v1/projects/<id>` solleva `AttributeError` non appena valuta questa riga — non è un caso limite, è sistematico su ogni singola richiesta a questo endpoint.

**Fix proposto**:
```python
'customer_email': project.email_from or '',
```

### Problema 2 — `contact_name` usato per il telefono (riga 74) — bug di qualità dati, non crash

```python
'customer_phone': project.contact_name or '',
```

`contact_name` esiste (non crasha), ma è il **nome** della persona di contatto, non il telefono — il campo telefono reale è `phone`. Il valore restituito in `customer_phone` è quindi sempre semanticamente sbagliato (es. "Mario Rossi" al posto di "+39 333 1234567"), un bug silenzioso di qualità dati verificabile solo leggendo l'output, mai un errore.

**Fix proposto**:
```python
'customer_phone': project.phone or '',
```

### Problema 3 — bug hasattr, solo sul conteggio documenti (riga 60)

```python
if hasattr(request.env, 'erpv6.library.document'):
    document_count = request.env['erpv6.library.document'].sudo().search_count([...])
```

Qui l'effetto è diverso dagli altri 9 controller: non essendoci un branch 501 esplicito, l'hasattr sempre-`False` non blocca la risposta — semplicemente `document_count` resta sempre `0`, silenziosamente, anche quando ci sono documenti reali collegati al progetto. Si somma al problema, già coperto alla voce #7, che `erpv6_library` non è comunque dependency del gateway.

**Fix proposto**:
```python
document_count = 0
if 'erpv6.library.document' in request.env:
    document_count = request.env['erpv6.library.document'].sudo().search_count([
        ('project_id', '=', project.id)
    ])
```

(diventa effettivamente funzionante solo dopo aver applicato anche il fix #2 di `library_api.py` — aggiunta di `erpv6_library` ai `depends` del gateway; senza quello, `'erpv6.library.document' in request.env` resterebbe comunque `False` su un'installazione dove `erpv6_library` non fosse già presente per altra via.)

**Riepilogo blocco fix da applicare insieme a riga 65-78**:

```python
            data = {
                'id': project.id,
                'name': project.name or '',
                'stage': project.stage_id.name if project.stage_id else '',
                'expected_revenue': project.expected_revenue or 0.0,
                'probability': project.probability or 0,
                'create_date': project.create_date.isoformat() if project.create_date else None,
                'description': project.description or '',
                'customer_email': project.email_from or '',
                'customer_phone': project.phone or '',
                'user_id': project.user_id.name if project.user_id else '',
                'date_deadline': project.date_deadline.isoformat() if project.date_deadline else None,
                'document_count': document_count,
            }
```

---
