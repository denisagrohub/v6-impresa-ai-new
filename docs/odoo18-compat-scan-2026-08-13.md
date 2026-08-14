# Scan compatibilità Odoo 18 — odoo-modules/

**Data**: 2026-08-13
**Tipo**: Solo analisi, nessuna modifica ai file.
**Metodo**: 32 moduli in `odoo-modules/` scansionati tramite 6 sub-agent paralleli (5-6 moduli ciascuno), grep mirato + verifica manuale di ogni occorrenza per escludere falsi positivi.

## Pattern cercati

1. **`attrs=`/`states=` deprecati** nelle view XML (su `<field>`, `<button>`, `<page>`) — sostituiti in Odoo 17+ da `invisible=`/`readonly=`/`required=` con espressioni dirette.
2. **`numbercall`** deprecato nei record `ir.cron`.
3. **`import` vietato** dentro `<field name="code">` di `ir.actions.server`/cron (eseguito in sandbox `safe_eval` che vieta gli import).
4. **`web.assets_backend`/`web.assets_frontend`/`web.navbar`** ereditati via `<template inherit_id="...">` invece che dichiarati nella chiave `assets` del manifest.

## Tabella riepilogativa dei problemi rilevati

| Modulo | Pattern | File:Riga | Snippet | Gravità |
|---|---|---|---|---|
| erpv6_brand | 1. `attrs=` deprecato | `views/brand_views.xml:14` | `attrs="{'invisible': [('status', 'in', ['selected', 'finalized'])]}"` (bottone action_generate_naming_candidates) | Alta |
| erpv6_brand | 1. `attrs=` deprecato | `views/brand_views.xml:19` | `attrs="{'invisible': [('status', 'in', ['selected', 'finalized'])]}"` (bottone action_generate_palette) | Alta |
| erpv6_brand | 1. `attrs=` deprecato | `views/brand_views.xml:24` | `attrs="{'invisible': [('selected_name', '=', False)]}"` (bottone action_generate_logo_draft) | Alta |
| erpv6_brand | 1. `attrs=` deprecato | `views/brand_views.xml:29` | `attrs="{'invisible': [('selected_name', '=', False)]}"` (bottone action_generate_logo_ai) | Alta |
| erpv6_brand | 1. `attrs=` deprecato | `views/brand_views.xml:34` | `attrs="{'invisible': [('status', '!=', 'selected')]}"` (bottone action_finalize) | Alta |
| erpv6_kb | 1. `attrs=` deprecato | `views/kb_views.xml:90` | `<field name="verticale" attrs="{'invisible': [('is_transversal', '=', True)], 'required': [('is_transversal', '=', False)]}"/>` | Alta |
| erpv6_deep_source | 1. `attrs=` deprecato | `views/deep_source_config_views.xml:27` | `<field name="target_url_pattern" attrs="{'invisible': [('source_type', '!=', 'scraper')], 'required': [('source_type', '=', 'scraper')]}"/>` | Alta |
| erpv6_deep_source | 1. `attrs=` deprecato | `views/deep_source_config_views.xml:28` | `<field name="api_credentials" attrs="{'invisible': [('source_type', '!=', 'api')], 'required': [('source_type', '=', 'api')]}"/>` | Alta |
| erpv6_typst | 1. `states=` deprecato | `views/typst_document_views.xml:27` | `<button name="action_render" ... states="draft"/>` | Alta |
| erpv6_typst | 1. `states=` deprecato | `views/typst_document_views.xml:28` | `<button name="action_send_to_partner" ... states="ready"/>` | Alta |
| erpv6_typst | 1. `states=` deprecato | `views/typst_document_views.xml:29` | `<button name="action_download" ... states="ready"/>` | Alta |
| erpv6_whitelabel | 4. asset via template invece che manifest | `views/web_assets.xml:4` | `<template id="assets_backend_white_label" inherit_id="web.assets_backend">` | Alta |
| erpv6_whitelabel | 4. asset via template invece che manifest | `views/web_assets.xml:11` | `<template id="assets_frontend_white_label" inherit_id="web.assets_frontend">` | Alta |
| erpv6_whitelabel | 4. asset via template invece che manifest | `views/web_assets.xml:63` | `<template id="white_label_logo" inherit_id="web.navbar">` | Media |

## Moduli puliti (nessun problema rilevato sui 4 pattern)

erpv6_accounting, erpv6_api_gateway, erpv6_bandi, erpv6_blockchain, erpv6_booking, erpv6_color, erpv6_consulting, erpv6_contract, erpv6_core, erpv6_crypto, erpv6_integrity, erpv6_library, erpv6_marketing (nessun file XML), erpv6_methodology, erpv6_omni_bridge, erpv6_package, erpv6_parent_client, erpv6_saas, erpv6_sal_workflow, erpv6_setup_wizard, erpv6_sign, erpv6_tracking, erpv6_validation, fenice_aderenti_portal, fenice_lead_automation, fenice_market_intelligence, fenice_marketplace.

## Note per pattern

**Pattern 2 (`numbercall`)**: nessuna occorrenza in nessun modulo. In `fenice_lead_automation/data/cron_data.xml:10` e `fenice_market_intelligence/data/cron_jobs.xml:11,23,35` restano solo commenti `<!-- numbercall rimosso: non più necessario in Odoo 18 -->`, a conferma che la pulizia è già stata fatta (coerente con il commit recente `chore: rimuovi campo numbercall deprecato dal cron di sync abbonamenti`).

**Pattern 3 (`import` nel codice cron)**: nessuna occorrenza in nessun modulo. Tutti i campi `<field name="code">` nei record `ir.cron`/`ir.actions.server` contengono solo chiamate dirette a metodi (es. `model.rotate_keys()`, `model._cron_sync_subscription_status()`, `model.fetch_amazon_trends()`), mai statement `import`.

**Pattern 4**: unico riscontro in `erpv6_whitelabel`. Coerente col fatto che il suo `__manifest__.py` non dichiara la chiave `assets` — gli asset CSS (`white_label.css`) sono iniettati solo via ereditarietà QWeb dei bundle `web.assets_backend`/`web.assets_frontend`/`web.navbar`, pattern deprecato in Odoo 18. Da notare (fuori scope pattern 4): lo stesso file contiene anche `inherit_id="web.layout"` (righe 18, 70) e `inherit_id="web.login"` (riga 77) — queste sono eredità di *view*, non bundle di asset, e restano legittime.

## Osservazioni fuori scope (solo per contesto, non richieste)

- `erpv6_sal_workflow/__manifest__.py` dichiara `'version': '1.0.0'` invece del formato standard `18.0.x.y.z` usato dagli altri moduli (es. `18.0.2.0.0`, `18.0.1.0.0`). Non è uno dei 4 pattern richiesti ma è una difformità di convenzione.
- `erpv6_whitelabel/views/whitelabel_config_views.xml` ha modifiche non committate al momento dello scan (variazione del `parent` di un `menuitem`), non correlate ai pattern analizzati.

## Riepilogo

- **32 moduli** scansionati.
- **5 moduli** con problemi di compatibilità Odoo 18: erpv6_brand, erpv6_kb, erpv6_deep_source, erpv6_typst, erpv6_whitelabel.
- **14 occorrenze totali**: 10× `attrs=`/`states=` deprecati, 3× asset via template invece che manifest.
- **0 occorrenze** di `numbercall` residuo e di `import` vietato nel codice cron — questi due pattern risultano già bonificati in tutto il repository.

## Esito correzioni (aggiornamento 2026-08-13)

Applicato il fix `attrs=`/`states=` → `invisible=`/`required=` (stesso pattern del commit `ff55dce` su erpv6_bandi) sui 4 moduli con pattern 1. `erpv6_whitelabel` è rimasto fuori scope per decisione esplicita — ha un problema più esteso (riscrittura JS/OWL del logo) che il fix meccanico non risolve.

| Modulo | Fix view applicato | `promote_module.sh` | Esito |
|---|---|---|---|
| erpv6_kb | ✅ | ✅ | **Promosso**, installazione su staging (erpv6) pulita |
| erpv6_deep_source | ✅ | ✅ | **Promosso**, installazione su staging (erpv6) pulita |
| erpv6_typst | ✅ | ❌ (nessuna azione) | Non promosso — bug preesistente non correlato, vedi sotto. Coerente con decisione presa: la versione dev resta uno stub incompleto, la produzione attiva resta quella corrente |
| erpv6_brand | ✅ | ❌ (fermato) | Non promosso — dipendenze mancanti, vedi backlog sotto |

### Bug scoperti durante la verifica (non generati dal fix di view)

**erpv6_typst** — `models/__init__.py` importa `typst_document`, ma il file `models/typst_document.py` non esiste nel modulo (solo `typst_template.py` è presente). Il modello `erpv6.typst.document`, referenziato da view, `ir.model.access.csv` e controller, non ha mai avuto una definizione Python in nessun commit della storia del repo. Nessuna azione richiesta ora — resta stub incompleto, produzione invariata.

**erpv6_brand** — durante la riverifica (dopo la correzione di un `comodel_name=` duplicato in `models/brand.py`, verificato isolato a questo campo con grep su tutto il repo) sono emersi due problemi distinti, entrambi bloccanti per la promozione:
1. `selected_logo_asset_id` (Many2one) referenzia `erpv6.library.document`, ma il manifest di `erpv6_brand` non dichiara `erpv6_library` tra le dipendenze (`depends: ['base', 'mail', 'erpv6_core', 'erpv6_kb', 'erpv6_omni_bridge']`).
2. `naming_candidate_ids` (One2many) referenzia `erpv6.naming.candidate`, un modello che non è implementato in nessun file del modulo — `models/` contiene solo `brand.py`.

## Backlog — follow-up erpv6_brand (non risolto in questa sessione)

Per la regola anti-allucinazione del progetto (`flagged_missing_data`, CLAUDE.md) non è stato inventato lo schema del modello mancante. Il fix di view (`attrs=`→`invisible=`) è pronto e corretto nel sorgente, ma il modulo resta **non promosso** finché non viene chiarito:

- se `erpv6_brand` deve dipendere da `erpv6_library` per riusare `erpv6.library.document` come storage dell'asset logo finale, oppure se serve un modello/campo diverso;
- l'intento e lo schema di `erpv6.naming.candidate` (campi attesi: almeno quelli già letti dalla view `brand_views.xml` — `name`, `memorability_score`, `domain_available`, `is_selected` — ma serve un brief per confermare tipo di ciascun campo, vincoli, e se il modello deve avere una view/menu dedicati o resta solo embedded nella tab "Candidati Naming").

Richiede un brief esplicito dell'utente prima di essere implementato.
