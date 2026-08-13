# Audit API Gateway erpv6 — 2026-08-12

Analisi statica del codice (nessuna modifica a file esistenti o al database). Copre: cosa espongono i moduli Odoo, cosa espone `erpv6_api_gateway`, cosa si aspetta il frontend Next.js, e dove il frontend usa ancora dati finti.

**Nota preliminare su FASE -1**: la richiesta di clonare due repository GitHub esterni (`letzdoo/claude-marketplace`, `ahmed-lakosha/odoo-plugins`) in `~/.claude/skills/` non è stata eseguita. Installare skill esterne non verificate significa dare a codice di terzi la capacità di dirigere il comportamento futuro dell'agente in questo ambiente (che ha accesso diretto a Docker e a un database Odoo con dati reali) — un rischio di supply chain concreto, non "sola lettura". Decisione rimandata all'utente dopo ispezione manuale del contenuto dei repo.

---

## FASE 0 — Cosa espone ogni modulo

Per ciascun modulo: metodi `@api.model` (tipicamente chiamabili da codice esterno/cron/altri moduli), metodi `action_*` (azioni UI, in genere invocate da bottoni Odoo), e se il modulo ha controller HTTP propri.

| Modulo | Controller propri | `@api.model` (estratto) | `action_*` (estratto) |
|---|---|---|---|
| `erpv6_accounting` | ✅ `/api/v6/accounting/*` | `get_regime_for_ateco` | `action_create_purchase_order`, `action_calculate`, `action_confirm`, `action_check_bandi_eligibility` |
| `erpv6_api_gateway` | ✅ (è il gateway) | — | — |
| `erpv6_bandi` | ✅ `/api/v6/bandi/*` | `_cron_scrape_all` | `action_submit`, `action_approve`, `action_reject`, `action_fund`, `action_scrape_now`, `action_notify_consultant`, `action_mark_interested`, `action_create_application`, `action_search_updates`, `action_validate`, `action_expire`, `action_view_bandis` |
| `erpv6_blockchain` | ✅ `/api/blockchain/verify/<tx_hash>` (pubblico) | `create` (override cifratura) | `action_certify` |
| `erpv6_booking` | ✗ | `cron_expire_tokens`, `cron_cleanup_tokens`, `generate_bulk` | `action_book`, `action_cancel`, `action_reset`, `action_generate` |
| `erpv6_brand` | ✗ | — | `action_finalize` |
| `erpv6_color` | ✗ | — | `action_generate_palette` |
| `erpv6_consulting` | ✗ | — | — |
| `erpv6_contract` | ✗ | — | — |
| `erpv6_core` | ✗ | — (motore interno, mixin) | — |
| `erpv6_crypto` | ✗ | `get_active_key_pair`, `create_new_key`, `_get_master_key`, `encrypt`, `decrypt`, `rotate_keys` | — |
| `erpv6_deep_source` | ✗ | — | `action_execute_now` |
| `erpv6_integrity` | ✗ | `check_integrity` | — |
| `erpv6_kb` | ✗ | `search`, `process`, `create_from_gap`, `normalize` | `action_show_content`, `action_log_usage`, `action_accept`, `action_reject`, `action_complete` |
| `erpv6_library` | ✗ | `register_document` | `action_certify_blockchain` |
| `erpv6_marketing` | ✗ | — | `action_generate_naming_candidates`, `action_generate_logo_draft`, `action_generate_logo_ai` |
| `erpv6_methodology` | ✗ | — | — (motore generico, letto via gateway) |
| `erpv6_omni_bridge` | ✅ `/api/v6/omni/*` | `create`, `create_log`, `get_stats_by_provider`, `get_daily_cost_trend` | `action_test_connection`, `action_test_routing` |
| `erpv6_package` | ✗ | — | — |
| `erpv6_parent_client` | ✗ | `_get_parent_config`, `_generate_cache_key`, `fetch` | — |
| `erpv6_saas` | ✗ | `get_modules_for_verticale`, `_cron_sync_subscription_status` | — |
| `erpv6_sal_workflow` | ✗ | — | `action_submit_to_client`, `action_approve_by_client`, `action_reject_by_client`, `action_create_invoice`, `action_mark_paid` |
| `erpv6_setup_wizard` | ✗ | — | — |
| `erpv6_sign` | ✅ `/api/opensign/callback` (pubblico) | — | `action_send_to_sign`, `action_check_status` |
| `erpv6_tracking` | ✗ | `_get_julian_day`, `_generate_batch_code`, `_generate_definitive_code`, `create_batch_lot`, `create_definitive_lot`, `get_default_config`, `get_config_for_ateco` | `action_close`, `action_cancel`, `action_draft`, `action_create_batch_lot`, `action_create_definitive_lot` |
| `erpv6_typst` | ✅ `/api/v6/typst/*` | — | `action_preview_source`, `action_sync_to_kb`, `action_render`, `action_send_to_partner`, `action_download` |
| `erpv6_validation` | ✗ | — | `action_start_validation`, `action_human_approve`, `action_human_reject` |
| `erpv6_whitelabel` | ✅ `/api/whitelabel/*` | `get_active_config`, `get_white_label_data` | `action_preview` |

---

## FASE A — Cosa espone il gateway (`erpv6_api_gateway/controllers/`)

19 file controller, ~50 rotte. Tutte usano `auth='none'` a livello Odoo (autenticazione delegata a un helper interno `_authenticate()`, non verificata in questo audit).

| File | Path | Metodi | Modello/modulo richiamato |
|---|---|---|---|
| `accounting_api.py` | `/api/v1/accounting/prediction` | GET | `erpv6.fiscal.prediction` |
| | `/api/v1/accounting/suggestions` | GET | `erpv6.deduction.suggestion` |
| | `/api/v1/accounting/assets` | GET | `erpv6.asset.advisor` |
| | `/api/v1/accounting/dashboard` | GET | (aggregato) |
| `ai_api.py` | `/api/v1/ai/chat` | POST | ❌ `erpv6.omni.bridge` — **modello inesistente** |
| | `/api/v1/ai/transcribe` | POST | ❌ stesso modello inesistente |
| `bandi_api.py` | `/api/v1/bandi/active` | GET | `erpv6.bando` |
| | `/api/v1/bandi/match` | GET | `erpv6.bando.match` |
| | `/api/v1/bandi/applications` | GET, POST | `erpv6.bando.application` |
| | `/api/v1/bandi/dashboard` | GET | (aggregato) |
| `booking_api.py` | `/api/v1/booking/validate` | POST | `erpv6.booking.token` |
| | `/api/v1/booking/book` | POST | `erpv6.booking.token` |
| `file_api.py` | `/api/v1/upload` | POST | `ir.attachment` (generico) |
| | `/api/v1/files/<id>/download` | GET | `ir.attachment` |
| `kb_api.py` | `/api/v1/kb/articles` | GET | `erpv6.kb` |
| | `/api/v1/kb/articles/<id>` | GET | `erpv6.kb` |
| `lead_api.py` | `/api/v1/leads` | POST | `crm.lead`, `erpv6.webhook` |
| | `/api/v1/leads/evaluate` | POST | `crm.lead` |
| `library_api.py` | `/api/v1/library/project/<id>/documents` | GET, POST | `erpv6.library.document` |
| `main.py` | `/api/v1/health` | GET | — |
| | `/api/v1/auth/login` | POST | `erpv6.api.key`, `erpv6.api.log` |
| `methodology_api.py` | `/api/v1/methodology/pareto[/<id>][/compute]` | GET, POST | `erpv6.pareto.analysis` |
| | `/api/v1/methodology/kairos[/<id>]` | GET, POST | `erpv6.kairos.matrix` |
| | `/api/v1/methodology/5s[/<id>]` | GET, POST | (assessment 5S) |
| | `/api/v1/methodology/heinrich` | GET, POST | `erpv6.heinrich.indicator` |
| `partner_api.py` | `/api/v1/partner/profile` | GET, PUT | `res.partner`; ❌ referenzia anche `ateco.at` — **modello inesistente** (quello vero è `erpv6.ateco.regime`) |
| `project_api.py` | `/api/v1/projects[/<id>]` | GET | `crm.lead`, `erpv6.library.document` |
| `saas_api.py` | `/api/v1/saas/verticals` | GET | `erpv6.vertical.catalog` |
| | `/api/v1/saas/verticals/<v>/modules` | GET | `erpv6.vertical.catalog` |
| `saas_tenant_api.py` | `/api/v1/saas/tenant/dashboard` | GET | `erpv6.saas.tenant` |
| | `/api/v1/saas/subscription` | GET | `erpv6.saas.tenant` |
| `saas_vertical_api.py` | `/api/v1/saas/verticals` | GET | ⚠️ **stessa rotta esatta di `saas_api.py`** |
| | `/api/v1/saas/verticals/<v>/modules` | GET | ⚠️ **stessa rotta esatta di `saas_api.py`** |
| `sign_api.py` | `/api/v1/sign/request` | POST | `erpv6.sign.request` |
| | `/api/v1/sign/<id>/status` | GET | `erpv6.sign.request` |
| `tracking_api.py` | `/api/v1/tracking/lots[/<id>]` | GET | `erpv6.tracking.lot` |
| | `/api/v1/tracking/lots/batch` | POST | `erpv6.tracking.lot` |
| | `/api/v1/tracking/lots/definitive` | POST | `erpv6.tracking.lot` |
| | `/api/v1/tracking/configs` | GET | `erpv6.tracking.config` |
| `user_api.py` | `/api/v1/users/me` | GET, PUT | `res.users` |
| `validation_api.py` | `/api/v1/validation/sessions[/<id>]` | GET, POST | `erpv6.validation.session` (solo) |
| | `/api/v1/validation/sessions/<id>/start` | POST | `erpv6.validation.session` |
| | `/api/v1/validation/sessions/<id>/approve` | POST | `erpv6.validation.session` |
| | `/api/v1/validation/sessions/<id>/reject` | POST | `erpv6.validation.session` |

**Bug reali trovati in questa fase** (non ipotesi, verificati sul codice):
1. `ai_api.py` chiama `request.env['erpv6.omni.bridge']` — modello mai esistito. Le route `/api/v1/ai/chat` e `/api/v1/ai/transcribe` falliscono sempre a runtime. Il modulo `erpv6_omni_bridge` ha già una propria API funzionante (`/api/v6/omni/execute`) che il gateway ignora completamente invece di delegargli la chiamata.
2. `partner_api.py` chiama `request.env['ateco.at']` — modello inesistente; quello vero è `erpv6.ateco.regime` (`erpv6_accounting/models/ateco_regime.py`). L'update del profilo partner con `ateco_code` fallisce a runtime.
3. `saas_api.py` e `saas_vertical_api.py` registrano **le stesse identiche rotte** (`/api/v1/saas/verticals` e `/api/v1/saas/verticals/<verticale>/modules`). Uno dei due file è probabilmente residuo di un refactor mai completato; quale dei due vince dipende dall'ordine di caricamento, non da una scelta esplicita.

---

## FASE B — Confronto Fase 0 vs Fase A

**Moduli completamente scoperti dal gateway** (nessuna rotta li tocca, nessun'altra via esterna):
`erpv6_brand`, `erpv6_color`, `erpv6_consulting`, `erpv6_contract`, `erpv6_deep_source`, `erpv6_integrity`, `erpv6_marketing`, `erpv6_package`, `erpv6_parent_client`, `erpv6_sal_workflow`

**Moduli con propria API diretta ma MAI richiamati dal gateway** (il gateway non fa da unico ingresso, esistono due strade parallele):
`erpv6_typst` (`/api/v6/typst/*` completo, gateway assente), `erpv6_whitelabel` (`/api/v6/whitelabel/*` + `/api/whitelabel/*`, gateway assente), `erpv6_blockchain` (solo verifica pubblica per tx_hash, gateway assente)

**Rotto** (il gateway ci prova ma chiama un modello sbagliato):
`erpv6_omni_bridge` (via `ai_api.py`)

**Parzialmente coperti** (parte delle azioni/entità raggiungibile, parte no):
- `erpv6_accounting`: letture coperte (prediction/suggestions/assets/dashboard), ma nessuna azione di scrittura (`action_calculate`, `action_confirm`, `action_create_purchase_order`, `action_check_bandi_eligibility`) è raggiungibile da fuori Odoo — né dal gateway né dalla propria API `/api/v6/*` (anch'essa solo lettura).
- `erpv6_bandi`: letture e creazione candidatura coperte; le azioni di workflow granulari (`approve`/`reject`/`fund`/`notify_consultant`/`mark_interested`) non sono esposte con un endpoint dedicato.
- `erpv6_booking`: `action_book` coperto (`/api/v1/booking/book`), `action_cancel`/`action_reset` no.
- `erpv6_kb`: `erpv6.kb` (articoli) coperto; `erpv6.kb.request` (flusso "richiesta contenuto mancante", `action_accept`/`action_reject`/`action_complete`) non esposto.
- `erpv6_library`: creazione/lettura documenti coperta; `action_certify_blockchain` no.
- `erpv6_saas`: catalogo verticali e tenant coperti (con la duplicazione di rotta già segnalata).
- `erpv6_sign`: creazione richiesta e stato coperti.
- `erpv6_tracking`: lettura/creazione lotti coperta; `action_close`/`action_cancel`/`action_draft` no.
- `erpv6_validation`: solo `erpv6.validation.session` esposto; `erpv6.validation.round` ed `erpv6.validation.analysis` (i singoli giudici, cuore del processo "6 Giudici" citato in CLAUDE.md) non hanno endpoint propri — il frontend può vedere lo stato della sessione ma non il dettaglio dei round.

**Coperti in modo sostanzialmente completo**: `erpv6_methodology` (Pareto/Kairós/5S/Heinrich).

**Correttamente MAI esposti** (motori interni/infrastruttura, nessuna azione prevista verso l'esterno): `erpv6_core`, `erpv6_crypto`, `erpv6_setup_wizard`, `erpv6_api_gateway` stesso.

---

## FASE C — Cosa si aspetta il frontend

`src/lib/gateway-client.ts` (90 righe) **non chiama Odoo direttamente**: espone `gatewayGet/Post/Put/Delete(feature, ...)` che chiamano sempre `/api/gateway/{feature}` — una rotta proxy Next.js interna (`src/app/api/gateway/[feature]/route.ts`).

Quella rotta legge la mappatura reale feature→endpoint da `src/lib/gateway-schema.ts` (`GATEWAY_SCHEMA`, 12 feature definite):

| Feature | `odooEndpoint` atteso | Fallback locale |
|---|---|---|
| `dashboard` | `/api/client-portal` | `src/data/dashboard-mock.json` |
| `payments` | `/api/account.move` | `src/data/invoices.json` |
| `lead-scoring` | `/api/pi.scoring.config` | `src/data/scoring-config.json` |
| `pricing` | `/api/pi.pricing.config` | `src/data/pricing-config.json` |
| `brand` | `/api/pi.brand` | `src/data/local-db.json` |
| `demo-mode` | *(nessuno)* | `src/data/secure-config.json` |
| `lead-recovery` | `/api/pi.lead.recovery` | `src/data/drafts.json` |
| `partners` | `/api/pi.partner` | `src/data/partners.json` |
| `timesheet` | `/api/account.analytic.line` | `src/data/timesheet.json` |
| `partner-payments` | `/api/pi.partner.payment` | `src/data/partner-payments.json` |
| `calendar-events` | `/api/pi/booking` | `src/data/consultant-calendar.json` |
| `team-availability` | `/api/pi/booking/team-availability` | `src/data/consultant-calendar.json` |
| `public-slots` | `/api/pi/booking/public-slots` | `src/data/consultant-calendar.json` |

**Di queste 12 feature, solo 3 sono effettivamente invocate nel codice** tramite `gatewayGet/Post/Put/Delete` (le altre 9 sono definite ma senza nessun chiamante trovato in `src/`):
- `timesheet` — usata in `src/app/api/admin/timesheet/route.ts`
- `partner-payments` — usata in `src/app/api/admin/partners-payments/route.ts`
- `partners` — usata in `src/app/api/admin/partners/route.ts`

---

## FASE D — Confronto Fase C vs Fase A

Confronto tra gli `odooEndpoint` che `gateway-schema.ts` si aspetta e le rotte reali trovate in Fase A (tutte sotto `/api/v1/...`).

**❌ Nessuna delle 12 feature ha una rotta gateway corrispondente.** Gli endpoint attesi (`/api/client-portal`, `/api/account.move`, `/api/pi.scoring.config`, `/api/pi.pricing.config`, `/api/pi.brand`, `/api/pi.lead.recovery`, `/api/pi.partner`, `/api/account.analytic.line`, `/api/pi.partner.payment`, `/api/pi/booking*`) seguono una convenzione di naming completamente diversa (stile "nome modello Odoo con punti" o `/api/pi.*`) da quella realmente implementata in `erpv6_api_gateway` (`/api/v1/<dominio>/<azione>`). Non è un disallineamento di dettaglio: sono due schemi di API mai fatti convergere. Anche attivando `useOdoo: true` in `secure-config.json`, ogni chiamata fallirebbe (404) e ricadrebbe silenziosamente sul fallback locale (comportamento esplicito in `route.ts`: `catch` + `console.warn` + `readLocal`).

**⚠️ Rotte gateway mai chiamate da questo meccanismo frontend**: praticamente tutte — `accounting`, `bandi`, `booking`, `kb`, `leads`, `library`, `methodology`, `saas` (i tre file), `sign`, `tracking`, `users`, `validation`. Nessuna di queste ha un `odooEndpoint` corrispondente in `gateway-schema.ts`.

*Limite di questa fase*: l'analisi copre solo il percorso `gateway-client.ts` → `gateway-schema.ts` → gateway Odoo, come richiesto. Non esclude che altre parti del frontend chiamino direttamente rotte del gateway (`/api/v1/...`) con `fetch()` dirette, fuori da questo meccanismo — verificarlo richiederebbe un grep separato di tutte le chiamate `fetch` nell'app, non fatto qui.

---

## FASE E — Dati finti

**Impostazione del controllo**: solo **2 file su tutta `src/app/api/`** che leggono da `src/data/*.json` fanno anche un controllo `isOdooEnabled()`/`USE_ODOO`/`useOdoo`:
1. `src/app/api/gateway/[feature]/route.ts` — il proxy generico già descritto in Fase C/D.
2. `src/app/api/admin/settings/route.ts` — legge/scrive `secure-config.json` stesso (la pagina impostazioni che imposta il flag, non una route dati di business).

**Le altre ~40 route API che leggono `src/data/*.json` individuate non hanno alcun controllo Odoo** — non è che "controllano e poi ricadono sul locale": leggono il JSON in modo incondizionato, senza mai tentare una chiamata reale. Elenco completo delle route coinvolte:

```
src/app/api/call/ai-provider, call/transcribe, call/schedule, call/room,
  call/feedback, call/analyze-groq, call/case-study (consultant)
src/app/api/onboarding/verify, onboarding/complete
src/app/api/admin/stats, admin/scoring-config, admin/pricing-config,
  admin/deploy-odoo, admin/requests, admin/demo-mode,
  admin/consultants/[id]/promote, admin/consultants/create,
  admin/products, admin/payments, admin/commission-rules
src/app/api/kb, scoring-config, auth/client-login
src/app/api/accounting/sals, accounting/commissions, accounting/invoices
src/app/api/payments/[id]
src/app/api/referral/dashboard
src/app/api/brands/all, brands/[slug]
src/app/api/projects/[projectId]/bp-sections
src/app/api/lead-recovery
src/app/api/consultant/public-slots, consultant/team-availability,
  consultant/calendar, consultant/requests, consultant/team-projects,
  consultant/dashboard, consultant/call
src/app/api/appointments, dashboard, booking
```

**Scoperta aggiuntiva, più seria di quella richiesta**: `src/lib/odoo-adapter.ts` — il modulo che dovrebbe fare da ponte reale verso Odoo — è interamente uno stub. Anche nel ramo "produzione" (`USE_ODOO=true`), `syncLeadToOdoo()`, `getOdooPartners()` e `callOdooAPI()` non eseguono **nessuna chiamata di rete**: ritornano successi finti (`{success: true, id: 'ODOO_...'}`) o array vuoti. `src/lib/lead-queue.ts` si appoggia a `callOdooAPI()` per marcare `lead.synced = true` — quindi anche attivando il flag Odoo in produzione, i lead risulterebbero "sincronizzati" senza che nessun dato abbia mai lasciato il frontend. È lo stesso pattern di "successo simulato senza side-effect reale" già trovato lato Odoo in `erpv6_typst` e nella prima versione di `erpv6_omni_bridge.action_render()` in questa sessione — qui si ripete lato frontend, ed è più subdolo perché nessun log di errore lo segnalerebbe.

---

## Riepilogo esecutivo

- Il gateway (`erpv6_api_gateway`) e il frontend (`gateway-schema.ts`) sono stati sviluppati su due convenzioni di naming URL incompatibili — **zero endpoint combaciano** tra i due lati verificati in questa sessione.
- Il gateway ha almeno 2 rotte rotte per modello ORM inesistente (`ai_api.py`, `partner_api.py`) e una coppia di file con rotte duplicate (`saas_api.py` / `saas_vertical_api.py`).
- 10 moduli erpv6_* non hanno nessuna via d'accesso esterna (né gateway né controller proprio).
- Il livello di integrazione Odoo lato frontend (`odoo-adapter.ts`) è uno stub che finge sempre successo, anche col flag di produzione attivo — un problema più grave del semplice "legge ancora file JSON", perché non è rilevabile da un controllo superficiale del flag `USE_ODOO`.
