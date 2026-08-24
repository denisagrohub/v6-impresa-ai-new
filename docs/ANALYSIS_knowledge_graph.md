# Fase 0 — Analisi dello stato reale per il Knowledge Graph erpv6

Sola lettura, nessuna modifica a codice o dati. Tutti i numeri sotto vengono da introspezione diretta (`odoo shell` in sola lettura sul DB `erpv6`) o dal filesystem del VPS/repo, non da assunzioni o riepiloghi precedenti.

## 1. Inventario moduli reale

`/opt/erpv6/custom-addons/` (VPS) e `odoo-modules/` (repo) sono **identici**, zero discrepanze (`diff` pulito su 34 cartelle modulo). Non ho trovato nessun modulo VPS-only oltre ai 6 già noti nel prompt — anzi, tutti e 6 (`erpv6_booking`, `erpv6_contract`, `erpv6_package`, `erpv6_sal_workflow`, `fenice_aderenti_portal`, `fenice_marketplace`) sono già presenti in entrambi. Nessuna necessità di fermarsi qui.

**Anomalia trovata, non un modulo**: `/opt/erpv6/custom-addons/pi_booking.zip` — un archivio zip, mai estratto, non installato, non presente nel repo. Non è uno dei moduli attesi. Non l'ho toccato (sola lettura); da chiarire con l'utente cosa sia prima di qualunque pulizia.

**MODULE.md**: il prompt fa riferimento a "il pattern MODULE.md già in uso nel progetto" — verificato: **non esiste NESSUN file `MODULE.md` in nessuno dei 31 moduli `erpv6_*`** nel repo. Il pattern non è "già in uso", è da introdurre da zero se lo si vuole adottare. Flag esplicito per evitare di costruire la Fase 1 su una premessa falsa.

## 2. Introspezione Odoo (numeri reali, `erpv6 shell`, sola lettura)

| Metrica | Valore |
|---|---|
| Moduli `installed` | 164 |
| Moduli totali noti a Odoo (`ir.module.module`) | 740 |
| Modelli totali (`ir.model`) | 690 |
| Campi totali (`ir.model.fields`) | 13.518 |
| Campi relazionali (many2one/one2many/many2many) | 4.308 |

`odoo shell` confermato utilizzabile per introspezione in sola lettura su staging (`erpv6`).

## 3. Pipeline KB — schema reale (non quello presunto nel prompt)

**Correzione di nomenclatura**: il prompt cita `erpv6.kb.knowledge` ed `erpv6.validation` come se fossero singoli modelli. Verificato via `ir.model`: **non esistono con questi nomi**. I nomi reali sono:

- **`erpv6.kb`** (non `erpv6.kb.knowledge`) — 52 campi, tra cui: `content`, `content_format`, `kb_type`, `category_id`, `source` (stringa `library_document:<id>:<nome>`, non un FK), `source_document_id` (FK reale con `ondelete='cascade'`, aggiunto stanotte per la conoscenza-agente), `agent_config_id`, `is_active`, `access_level`, `embedding`, `version`, `prompt_approval_state`.
- **`erpv6.validation.session`** — stato (`status`), `max_rounds` ✅ (confermato, esiste esattamente come citato nel prompt), `current_round_number`, `human_reviewer_id`/`human_reviewed_at` (primo gate), `kb_supervisor_id`/`kb_supervisor_approved_at` (secondo gate), `certificate_sent`.
- **`erpv6.validation.round`** — un record per round, `analyst_prompt_ref`, `sesto_prompt_ref`, `issues_found`, `is_ai_failure`.
- **`erpv6.validation.analysis`** — un record per analista per round: `claims_checked` ✅ e `flagged_missing_data` ✅ (confermati, esistono esattamente come citati nel prompt), `findings`, `analyst_index`.

Il pattern reale è quindi **3 modelli collegati**, non un modello `erpv6.validation` unico con quei campi direttamente sopra.

**`requires_primary_verification`**: verificato via `ir.model.fields` su TUTTO lo schema — **non esiste in nessun modello**. Gap confermato come sospettato nel prompt, non ancora costruito da nessuna parte (né per bandi né altrove).

**PR #31/#32**: verificate su `git log origin/main` — reali e corrispondono esattamente a "pipeline documento->KB via AI con gate di validazione 6 Giudici" (PR #31) e un fix successivo di resilienza estrazione (PR #32, commit `76509c3`).

## 4. Ambiente per un grafo

- **Neo4j**: non installato in nessuna forma (nessun container, nessun pacchetto, nessun binario `neo4j`/`cypher-shell` su host o nel container `odoo`).
- **RAM VPS**: 7,8 GiB totali. `free`: solo 432 MiB liberi in senso stretto, ma 4,9 GiB "available" (cache riutilizzabile) — con Odoo + Postgres + Documenso (4 container: app, minio, gotenberg, redis) + Caddy già attivi, la macchina non è vuota. Un Neo4j Community (tipicamente 1-2 GiB di heap minimo consigliato) ci starebbe ma toglierebbe margine reale, non è "spazio abbondante" — da valutare esplicitamente con l'utente prima di avviarlo, non da dare per scontato.
- **Disco**: 53 GiB liberi su 79 GiB (30% usato) — nessun problema qui.
- **Porte**: nessun conflitto — Neo4j userebbe di default 7474 (browser HTTP) e 7687 (Bolt), entrambe libere (occupate oggi: 8069/8071-8072 Odoo, 5432 Postgres, 80/443 Caddy, 3000/9000/6379 stack Documenso).
- **`ast`** (stdlib Python): disponibile nel container `odoo` (Python 3.12.3) — nessuna installazione necessaria per un futuro estrattore AST.
- **`code2flow`**: NON installato, né sull'host VPS né nel container `odoo` (l'host non ha nemmeno `pip3` disponibile in PATH).

## 5. Checklist — pronto vs mancante per la Fase 1

**Pronto:**
- Introspezione Odoo via `odoo shell` funzionante e già usata stanotte per numeri reali.
- Schema KB/validazione reale, verificato, documentato sopra — utilizzabile subito per progettare l'estensione ontologica (1C).
- `ast` stdlib già disponibile per un futuro estrattore di livello 2 (AST call-graph), quando si arriverà a quello step.
- Nessun blocco di dipendenze software per il Livello 1 (estrazione da `ir.model`/`ir.model.fields`/`ir.module.module` — sono tutte query ORM standard).

**Mancante/da decidere prima della Fase 1:**
- Nessun `MODULE.md` esiste: se la Fase 1 vuole taggare i nodi-modulo con metadati (origin/status), quella fonte non esiste ancora — va deciso se introdurla ora o derivare i tag diversamente (es. da `ir.module.module` + una lista statica per i 7 moduli "planned").
- Nessuna installazione Neo4j: la Fase 1D (docker-compose) parte da zero, e la RAM disponibile è **sufficiente ma non abbondante** — merita una conferma esplicita, non un "via libera" implicito.
- `pi_booking.zip`: anomalia non chiarita, non correlata al grafo ma trovata durante l'inventario — segnalata, non toccata.
- `requires_primary_verification`: confermato assente ovunque, coerente col prompt che lo dava per gap — nessuna azione qui, solo conferma.
