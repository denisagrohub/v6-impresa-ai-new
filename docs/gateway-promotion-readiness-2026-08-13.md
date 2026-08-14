# Audit readiness promozione — 14 controller di erpv6_api_gateway mai promossi

**Data**: 2026-08-13
**Tipo**: Solo analisi, nessuna modifica, nessuna promozione.
**Metodo**: 4 sub-agent paralleli (Explore, 3-4 controller ciascuno), lettura integrale di ogni controller + verifica incrociata di ogni modello/campo/metodo referenziato contro il codice sorgente reale in `odoo-modules/`, i manifest (dev e prod), e — nel gruppo B — anche contro lo schema reale del database Odoo di produzione (`ir_model_fields`, `ir_module_module`).

## Contesto

`odoo-modules/erpv6_api_gateway/controllers/` ha 18 file controller. Solo 4 sono già in produzione (`/opt/erpv6/custom-addons/erpv6_api_gateway/controllers/`): `main.py`, `kb_api.py`, `booking_api.py`, `ai_api.py`, `lead_api.py`. I 14 mai promossi sono l'oggetto di questo audit.

Domanda guida per ciascuno: **se venisse promosso oggi, si installerebbe/funzionerebbe pulito, o ha lo stesso tipo di disallineamento dev/produzione già visto altrove nel repo (dipendenza mancante nel manifest, modello/campo referenziato ma mai esistito)?**

## ⚠️ Bug trasversale: `hasattr(request.env, 'modello.puntato')` è sempre `False`

**9 dei 14 controller** usano questo pattern come guardia "il modulo è installato?" prima di eseguire la logica reale:

```python
if not hasattr(request.env, 'erpv6.xxx.yyy'):
    return self._json_response({'error': '... module not installed'}, 501)
```

`request.env` (`odoo.api.Environment`) risolve i modelli via `__getitem__`/`Mapping` (`request.env['erpv6.xxx.yyy']` o `'erpv6.xxx.yyy' in request.env`), **non** via attributo Python puntato. `hasattr()` su una stringa con punti non è mai vero per nessun modello, installato o meno — quindi la guardia si attiva **sempre**, indipendentemente dallo stato reale del modulo.

Effetto pratico: in questi controller la guardia oggi funziona da "airbag" accidentale — maschera crash e mismatch di campo/modello reali perché il codice sotto di essa non viene mai eseguito. **Correggere solo l'`hasattr` senza correggere anche i mismatch sottostanti trasformerebbe endpoint silenziosamente inerti (501) in endpoint che crashano (500) o scrivono dati sbagliati.** Le due correzioni vanno fatte insieme, controller per controller.

Controller affetti: `accounting_api.py`, `bandi_api.py`, `library_api.py`, `methodology_api.py`, `project_api.py` (solo sul conteggio documenti), `saas_tenant_api.py`, `saas_vertical_api.py`, `sign_api.py`, `validation_api.py`.

## Tabella riepilogativa

| Controller | Importato in `__init__.py` (dev) | Verdetto | Causa principale |
|---|---|---|---|
| `file_api.py` | ✅ | **PRONTO** | Nessun problema — usa solo `ir.attachment`, modello core |
| `user_api.py` | ✅ | **PRONTO** | Nessun problema — usa solo `res.users`/`res.partner`, campi standard |
| `tracking_api.py` | ❌ | **CODICE MORTO IN DEV** (ma pulito se agganciato) | Non importato in `__init__.py`; modelli/campi/metodi corrispondono esattamente, `erpv6_tracking` già in depends (dev+prod) |
| `saas_tenant_api.py` | ❌ | **CODICE MORTO IN DEV** | Non importato; modelli/campi corretti, `erpv6_saas` già in depends dev; ma ha il bug `hasattr` |
| `saas_vertical_api.py` | ❌ | **CODICE MORTO IN DEV** | Non importato; modelli/campi corretti; ma ha il bug `hasattr` |
| `accounting_api.py` | ❌ | **CODICE MORTO IN DEV** | Non importato; modelli/campi corretti, `erpv6_accounting` raggiungibile via `erpv6_tracking`; ma ha il bug `hasattr` |
| `bandi_api.py` | ❌ | **CODICE MORTO IN DEV** + sarebbe **BLOCCATO** | Non importato; `erpv6_bandi` **non** in depends (né diretta né transitiva); bug `hasattr` |
| `methodology_api.py` | ❌ | **CODICE MORTO IN DEV** + sarebbe **BLOCCATO** | Non importato; `erpv6_methodology` **non** in depends di nessun modulo raggiungibile; bug `hasattr` |
| `validation_api.py` | ❌ | **CODICE MORTO IN DEV** + **BLOCCATO** | Non importato; `erpv6_validation` **non** in depends (né dev né prod) |
| `library_api.py` | ✅ | **BLOCCATO** | `erpv6_library` non in depends; campo `file_id` inesistente sul modello (reale: `file`); bug `hasattr` maschera tutto oggi |
| `partner_api.py` | ✅ | **BLOCCATO** | Modello `ateco.at` inesistente (reale: `erpv6.ateco.regime`); campi `ateco_code`/`fiscal_regime` inesistenti (reali: `v6_ateco_code`/`v6_fiscal_regime`) — la PUT risponde 200 "salvato" senza salvare nulla |
| `project_api.py` | ✅ | **BLOCCATO** | `crm.lead.contact_email` inesistente → **crash 500 garantito** su ogni GET dettaglio progetto; `document_count` sempre 0 (bug `hasattr` + `erpv6_library` non in depends) |
| `saas_api.py` | ✅ | **BLOCCATO** | Dipendenza circolare di manifest: `erpv6_saas` dipende da `erpv6_api_gateway` e (in dev) `erpv6_api_gateway` dipende da `erpv6_saas` — grafo non risolvibile da Odoo |
| `sign_api.py` | ✅ | **BLOCCATO** | `erpv6_sign` non in depends; **6 mismatch reali** di campo/comodel su `erpv6.sign.request` (`name` obbligatorio omesso, comodel sbagliato su `document_id`, campo `requested_by` inesistente, valore Selection non valido, `access_token` inesistente su `res.partner`, `signed_document_id` inesistente — reale `signed_document`); oggi mascherati dal bug `hasattr` |

## Dettaglio per controller

### PRONTI

**`file_api.py`** — Usa solo `ir.attachment` (modello core, sempre disponibile). Campi/metodi (`name`, `datas`, `mimetype`, `res_model`, `res_id`, `file_size`, `exists()`, `browse()`) tutti standard. Import Python solo stdlib (`base64`, `time`). Nessun problema trovato.

**`user_api.py`** — Non referenzia modelli custom: usa `res.users`/`res.partner` via l'oggetto `user` restituito da `_authenticate()`. Campi (`partner.phone`, `user.name/email/company_id/partner_id`) tutti standard. Nessuna dipendenza mancante.

### CODICE MORTO IN DEV, ma pulito se agganciato

**`tracking_api.py`** — Non importato in `__init__.py`. Modelli `erpv6.tracking.lot` e `erpv6.tracking.config` esistono in `erpv6_tracking/models/`, tutti i campi e i metodi (`create_batch_lot`, `create_definitive_lot`) usati dal controller corrispondono esattamente alle firme reali. `erpv6_tracking` è già dependency sia in dev che in prod. Nessun bug `hasattr`. **Unico problema: non è agganciato in `__init__.py`.**

### CODICE MORTO IN DEV, con problemi aggiuntivi se agganciato

**`saas_tenant_api.py`** e **`saas_vertical_api.py`** — Non importati. Modelli `erpv6.saas.tenant`/`erpv6.vertical.catalog` e relativi campi corrispondono, `erpv6_saas` già in depends dev. Ma entrambi usano il pattern `hasattr` rotto — anche agganciati, risponderebbero sempre 501.

**`accounting_api.py`** — Non importato. Modelli `erpv6.fiscal.prediction`, `erpv6.deduction.suggestion`, `erpv6.asset.advisor` esistono con campi corretti, `erpv6_accounting` raggiungibile transitivamente via `erpv6_tracking`. Ma bug `hasattr` presente — endpoint sempre 501 se agganciato.

**`bandi_api.py`** — Non importato. Modelli/campi di `erpv6_bandi` corrispondono, ma `erpv6_bandi` **non è dependency** né diretta né transitiva di `erpv6_api_gateway` — se il DB target non avesse già `erpv6_bandi` installato per altra via, `request.env['erpv6.bando']` solleverebbe `KeyError`. Più bug `hasattr`.

**`methodology_api.py`** — Non importato. Modelli (`erpv6.pareto.analysis`, `erpv6.kairos.matrix`, `erpv6.matrix5s.assessment`, `erpv6.heinrich.indicator`) esistono ma `erpv6_methodology` non è dependency di nessun modulo raggiungibile dal gateway. Più bug `hasattr`.

**`validation_api.py`** — Non importato. Modelli (`erpv6.validation.session/round/analysis`) e relativi campi/metodi corrispondono perfettamente, ma `erpv6_validation` non è in depends né in dev né in prod.

### BLOCCATI (già vivi in dev, ma non pronti)

**`library_api.py`** — `erpv6_library` non è dependency del gateway (né diretta né transitiva). Inoltre il controller scrive/legge un campo `file_id` che non esiste sul modello `erpv6.library.document` (il campo reale è `file`, Binary) — la POST fallirebbe con `ValueError` in `create()`, la GET con `AttributeError`. Oggi il bug `hasattr` maschera entrambi i problemi restituendo sempre 501.

**`partner_api.py`** — Bug di naming doppio: il modello referenziato `ateco.at` non esiste (il reale è `erpv6.ateco.regime`, aggiunto da `erpv6_accounting`, comunque raggiungibile transitivamente); i campi controllati con `hasattr(partner, 'ateco_code')`/`hasattr(partner, 'fiscal_regime')` non esistono su `res.partner` (i reali sono `v6_ateco_code`/`v6_fiscal_regime`). Effetto: non crasha, ma la PUT risponde `200` "salvato" mentre non scrive mai nulla — un contratto API silenziosamente falso, dello stesso tipo del bug originale in `odoo-adapter.ts` risolto in Fase 1.

**`project_api.py`** — `crm.lead.contact_email` non esiste (verificato anche contro lo schema reale del DB di produzione; il campo giusto è `email_from`) → crash 500 garantito su ogni chiamata a `GET /api/v1/projects/<id>`. `contact_name` è mappato erroneamente su `customer_phone` (bug di qualità dati, non crash). `document_count` è sempre 0 per il bug `hasattr` (e comunque `erpv6_library` non è in depends).

**`saas_api.py`** — Non un problema di campi: unico blocco è che `erpv6_saas/__manifest__.py` dipende già da `erpv6_api_gateway`, e il manifest **dev** di `erpv6_api_gateway` dipende a sua volta da `erpv6_saas` — dipendenza circolare che Odoo non può risolvere. In prod oggi il manifest di `erpv6_api_gateway` non dichiara `erpv6_saas`, e il controller funzionerebbe solo per un "incidente" di stato del DB (`erpv6_saas` risulta già installato indipendentemente) — stesso antipattern "comodel non dichiarato nelle depends" visto altrove, con l'aggravante che non è risolvibile semplicemente aggiungendo la dependency mancante (creerebbe il ciclo).

**`sign_api.py`** — Il più danneggiato dei 14: oltre a `erpv6_sign` mancante dalle depends, il ramo "reale" del codice (oggi mai eseguito grazie al bug `hasattr`) ha 6 problemi distinti su `erpv6.sign.request`: campo obbligatorio `name` omesso in `create()`; `document_id` puntato al comodel sbagliato (passa un id di `ir.attachment`, ma il campo è `Many2one('erpv6.typst.document')`); campo `requested_by` inesistente; valore `'pending'` non valido per la `Selection` di stato; `sign_partner.access_token` inesistente su `res.partner`; `sign_request.signed_document_id` inesistente (reale: `signed_document`).

## Osservazioni per la pianificazione del lavoro futuro (nessuna azione richiesta ora)

- **7 dei 14 controller non sono nemmeno agganciati in `controllers/__init__.py` di dev** — prima di ragionare su "promozione" per questi, la domanda a monte è se vadano completati/agganciati o abbandonati.
- Il bug `hasattr` è un fix meccanico a riga singola per controller, ma **va applicato controller per controller insieme alla correzione dei mismatch reali che maschera**, altrimenti si trasformano 501 silenziosi in 500 rumorosi.
- Tre pattern di dipendenza mancante nel manifest (`erpv6_bandi`, `erpv6_methodology`, `erpv6_validation`, `erpv6_library`, `erpv6_sign` non dichiarati) ricalcano esattamente il bug già trovato e corretto in `erpv6_brand`/`erpv6_kb` nella sessione precedente — non è un caso isolato, è un pattern ricorrente nel modo in cui questi controller sono stati scritti (probabilmente sviluppati riferendosi a modelli "che esistono da qualche parte nel repo" senza verificare la dependency chain del modulo gateway).
- `saas_api.py` è un caso a parte: non basta "aggiungere la dependency mancante", perché genererebbe un ciclo. Richiede una decisione di design (es. spostare l'endpoint SaaS in un modulo dedicato, o invertire la direzione della dipendenza).

## Riepilogo numerico

- **14 controller** analizzati.
- **2 PRONTI**: `file_api.py`, `user_api.py`.
- **7 CODICE MORTO IN DEV** (mai importati in `__init__.py`): `accounting_api.py`, `bandi_api.py`, `methodology_api.py`, `saas_tenant_api.py`, `saas_vertical_api.py`, `tracking_api.py`, `validation_api.py` — di questi, solo `tracking_api.py` sarebbe pulito se agganciato oggi.
- **5 BLOCCATI** (già vivi in dev ma non pronti per la promozione): `library_api.py`, `partner_api.py`, `project_api.py`, `saas_api.py`, `sign_api.py`.
- **9 controller** condividono il bug trasversale `hasattr(request.env, 'modello.puntato')`.

Fine Fase 2. Nessuna promozione eseguita. In attesa di ok per procedere.
