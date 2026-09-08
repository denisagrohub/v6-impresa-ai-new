# FASE 0 — Mappatura Circuiti AEOSv6 (solo lettura)

## A. SAFE_PROCESSES — elenco fresco dal codice (13 totali: 7 locali + 6 dispatch)

Verificato `core_node.py` (registro locale) + `erpv6_core_dispatch/registry.py` (popolato da `register_process()` in 4 moduli). Firma verificata via query diretta su `erpv6_core_process_input_spec`/`output_spec` (DB `erpv6`, non da memoria):

| process_key | famiglia | modulo | wrappa | input_spec | output_spec |
|---|---|---|---|---|---|
| `generate_phase_document` | IPO | core_node.py:59 | `production_order._generate_phase_output()` | 2 righe | ✓ |
| `ai_analyze` | AIPO | core_node.py:85 | `erpv6.omni.bridge.execute_ai_task()` diretto | 2 righe | ✓ |
| `kb_engine_process` | IPO | core_node.py:219 | `erpv6.kb.engine.process()` | **0 righe (gap)** | ✓ |
| `send_to_documenso` | ESTERNO | core_node.py:130 | `erpv6.sign.request.action_send_to_sign()` | 1 riga | ✓ |
| `heinrich_log_signal` | IPO | core_node.py:270 | `erpv6.heinrich.indicator.log_signal()` | 4 righe | ✓ |
| `pareto_log_item` | IPO | core_node.py:299 | backlog Pareto | 5 righe | ✓ |
| `crea_lead` | IPO | core_node.py:160 | `crm.lead.create()` (isolato da `lead_api.create_lead`) | 4 righe | ✓ |
| `create_tracking_lot` | IPO | erpv6_tracking/aeosv6_dispatch.py:46 | `erpv6.tracking.lot` | 5 righe | ✓ |
| `neo4j_write_fix` | ESTERNO | erpv6_kaizen/aeosv6_dispatch.py:76 | Neo4j client | 5 righe | ✓ |
| `kaizen_signal_to_context` | IPO | erpv6_kaizen/aeosv6_dispatch.py:81 | `erpv6.kaizen.detected_signal` | 1 riga | ✓ |
| `label_output` | IPO | erpv6_library/aeosv6_dispatch.py:113 | `erpv6.core.output` | 1 riga | ✓ |
| `file_to_library` | IPO | erpv6_library/aeosv6_dispatch.py:118 | `erpv6.library.document.register_document()` | 9 righe | ✓ |
| `disc_interview_score` | IPO | erpv6_disc_assessment/aeosv6_dispatch.py:80 | scoring DISC KB-driven | 1 riga | ✓ |

Nessuno di questi 13 è ancora usato nella catena intervista→kairós→relazione→business plan reale (sotto): quella catena oggi gira **tutta fuori dal grafo Nodo/Circuito**, come chiamate Python dirette da modello a modello.

## B. Sequenze reali (candidati Circuito, sezione E)

| Sequenza | Dove vive (file:riga) | Chi chiama chi | Motori esistenti (process_key) | Motori mancanti | Gate naturali | Dati di dominio prodotti |
|---|---|---|---|---|---|---|
| **1. Acquisizione dati minimi** | `apps/impresa/src/app/intervista/page.tsx:27,51` → `lib/lead-queue.ts:131 createPartialLead` → `erpv6_api_gateway/lead_api.py:40 create_lead` → `erpv6_production/crm_lead.py:221 _start_production` | Frontend → Next `/api/leads` (partial) → Odoo `/api/v1/leads` (qualified=false) → crea `crm.lead` type='lead' + `erpv6.production.order` fase='diagnostica' | `crea_lead` esiste ma **non è agganciato**: `lead_api.create_lead` fa ancora le 5 azioni in blocco, non chiama il Motore | — (il gap è di wiring, non di Motore) | Funzione: submit ultima delle 4 domande (nome/email/tel/azienda) | `crm.lead`, `erpv6.production.order` (score/verticale/budget vuoti) |
| **2. Avvio intervista ad albero** | `InterviewTreeFlow.tsx` → `lib/interview/tree-client.ts:92` → `erpv6_api_gateway/interview_api.py:52 start_interview` → `interview_engine.py:110 action_start` | Frontend → `/api/interview-tree/start` → Odoo `/api/v1/interview/start` → crea `erpv6.interview.session`, sceglie prima domanda radice per `verticale_id` | Nessuno nel grafo | **(b) nuovo**: nessun process_key per "avvia sessione intervista" | Funzione: redirect automatico da Fase 1 (`goToGuidata`, page.tsx:51) | `erpv6.interview.session` (draft→in_progress) |
| **3. Loop risposta→Kairós** | `interview_engine.py:126 action_answer` → `:152 _sync_answer_and_score` → `production_order.py:189 _compute_kairos_matrix` → `erpv6_methodology/kairos_matrix.py` | Ogni risposta → scrive `interview_<field_key>` su `erpv6.production.order` → richiama Kairós con **due input** (dati correnti + `previous_matrix_id`) → crea nuova `erpv6.kairos.matrix` agganciata alla precedente (mai media) | Kairós è già un Motore generico riusabile (`erpv6_methodology`), ma **non passa da SAFE_PROCESSES/dispatch** — chiamato Python diretto | **(a) da wrappare**: un process_key `kairos_compute` che avvolge `_compute_kairos_matrix()`, stesso schema di `generate_phase_document` | Nessun gate umano nel loop — automatico ad ogni risposta | `erpv6.kairos.matrix` (quadrante/impatto/prontezza), catena `previous_matrix_id` |
| **4. Chiusura intervista + qualificazione** | `interview_engine.py:221 _complete` → `crm_lead.py:221 _start_production` (idempotente) → `crm_lead.py:283 _promote_to_opportunity` (se BANT completo) | Fine albero → riversa risposte → ri-chiama `_start_production` → se `tipo_progetto`+`budget`+`tempistiche` presenti, promuove a opportunity: crea `project.project`, assegna consulente, ricalcola Kairós (upsert, non chained) | — | — | Funzione automatica (BANT completo), non umano | `crm.lead` type='opportunity', `project.project`, consulente assegnato |
| **5. Relazione Win-Win (+ DISC)** | `production_order.py:1145 _METODO_CONFIG`, `:1162 action_genera_analisi_win_win`, `:1205 _run_metodo_ai` | **Bottone manuale** (nessun trigger automatico) → legge KB `kb_metodo_analisi_winwin` (system prompt) + `_build_metodo_context_data()` (tutte le risposte intervista) → `erpv6.omni.bridge.execute_ai_task()` → salva come `erpv6.library.document` (markdown grezzo, **bypassa `erpv6.typst.engine`**) | `ai_analyze` esiste ma non wrappa questo (percorso parallelo, non riusato); `file_to_library`/`label_output` esistono ma non riusati (usa `register_document` diretto) | **(b) nuovo**: Circuito Metodo completo — oggi è tutto in un unico metodo monolitico (`_run_metodo_ai`), viola "un Motore = un'azione" (regola #3/#6 del generatore di circuiti) | **Manuale/umano**: click consulente | `erpv6.library.document` (category=proposal, is_final=True) — **testo .md, non PDF Typst** |
| **6. Business Plan** | `erpv6_production/data/prodotto_consulenza_data.xml:28-30` (fase output_category='business_plan', `typst_template_id`) → pipeline generica `production_order.py:523 _evaluate_and_advance_one` → `:312 _generate_phase_output` → `erpv6.typst.engine.generate_document(data=self._build_typst_data())` | Avanzamento fase automatico (cron) → template Typst reale esiste (`typst_template_business_plan_standard`, required_fields=executive_summary/market_analysis/financial_plan/swot_analysis) → MA `_build_typst_data()` (production_order.py:176) produce solo 5 campi generici (lead_name/email/interview_score/package_hint/verticale) | `generate_phase_document` esiste e wrappa correttamente `_generate_phase_output` | **(b) nuovo, il gap centrale**: manca il Motore AIPO "Win-Win → schema Business Plan" — nessun codice trasforma intervista+Win-Win+KB nei 4 `required_fields` del template. Con i dati attuali il render fallirebbe/produrrebbe un documento vuoto | Gate `_open_phase_gate` (procedi/pianifica/fermati, umano via Andrea/Susanna) + `_do_advance_after_gate` (blocca su tranche non incassate) | `erpv6.typst.document` PDF (se i dati bastassero) → `erpv6.library.document` (is_final) |
| **7. Firma/pagamento a valle** | `production_order.py:918 _ensure_nda_document`, `:954 _ensure_contratto_o_promessa`, `:870 _send_contract_document_to_sign` | Gate automatici su fase (`richiede_nda`/`richiede_contratto`) → genera PDF Typst → invia a Documenso | `send_to_documenso` esiste e corrisponde 1:1 a `action_send_to_sign()` | — | Gate umano su `richiede_pagamento` (tranche 'incassata') | `erpv6.contract.document`, `erpv6.sign.request` |

## C. Motori mancanti — riepilogo

**(a) da wrappare (funzione esistente, generalizzabile — schema già deciso in K.12):**
- `kairos_compute` — avvolge `production_order._compute_kairos_matrix()`, stesso pattern di `generate_phase_document`.

**(b) da costruire ex novo (nessun Motore reale dietro):**
1. `avvia_intervista` — avvolge `erpv6.interview.session.action_start()`.
2. Scomposizione del **Circuito Metodo Win-Win/DISC** (oggi `_run_metodo_ai` monolitico) in nodi atomici, seguendo lo schema già usato nel metodo generatore di circuiti (KB psicologica/marketing/verticale risolte a monte → Motore AIPO → decidi oscuramento) — **e farlo passare per `erpv6.typst.engine` invece di scrivere un `.md` grezzo**.
3. **Il Motore AIPO "Business Plan"**: unico vero gap bloccante della catena richiesta da Denis — trasforma (intervista + relazione Win-Win + KB destinatario Banca/Investitore/Partner/Interno) nello schema digerito `executive_summary/market_analysis/financial_plan/swot_analysis` che il template Typst reale già richiede. Senza questo, la fase 6 è wiring "vuoto": template e fase esistono, ma nessun codice produce il contenuto.

**Nota trasversale**: `kb_engine_process` ha 0 righe in `input_spec` — la sua firma reale (`KB_ENGINE_REQUIRED_INPUTS` in `core_node.py:209`) vive solo in un dizionario Python, mai rispecchiata nella tabella dichiarativa.

## D. Tre domande per Denis

1. **Il bug lead 400** (addendum: "cattura anticipata lead → Odoo 400 name/email required") è nella catena Fase 1→Fase 2 che ho appena mappato — vuoi che lo tratti come parte di questa Fase 0 (solo segnalazione) o è già un task separato da riprendere a parte?
2. Per il **Circuito Metodo Win-Win**, la relazione oggi produce un `.md` grezzo (mai passato da Typst). Prima di scomporlo in nodi: confermi che vuoi anche **agganciarlo a un template Typst reale** (oggi non esiste, `doc_category='proposal'` non ha `typst_template_id`), o per ora resta testo semplice e il lavoro Fase 2+ si concentra solo sulla decomposizione in Motori?
3. Il Motore mancante più critico è quello che trasforma Win-Win+intervista nei 4 `required_fields` del template Business Plan (`executive_summary`/`market_analysis`/`financial_plan`/`swot_analysis`). Prima di progettarlo: qual è lo **stato reale del prompt/KB** per quel Motore — esiste già una KB `metodo_v6` dedicata al Business Plan (come `kb_metodo_analisi_winwin` per il Win-Win), o va anche quella creata da zero con te?

Nessun file toccato, nessun commit — solo lettura come richiesto.
