# erpv6_methodology — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e verifica reale
sul database `erpv6` del VPS (non solo dichiarazioni statiche).

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.pareto.analysis` | `res_model`, `res_id` (link generico a qualsiasi record), `item_ids` (One2many), `total_score`, `priority_count` (compute), `notes` | Installato, mai popolato in produzione (0 record) |
| `erpv6.pareto.item` | `analysis_id`, `frequenza` (1-5), `impatto` (1-5), `punteggio` = frequenza×impatto (compute), `cumulata_pct` (compute), `is_priority` (compute: top 80% cumulato) | idem |
| `erpv6.kairos.matrix` | `res_model`, `res_id`, `matrix_type` (Selection: `organizzativo` / `finanziario` — solo 2 valori, hardcoded), `impatto_score`, `impatto_level` (compute), `indicatore_1..5` (prontezza 1-3 ciascuno, semantica doppia via help text), `prontezza_totale`/`prontezza_level` (compute), `quadrante` (compute: 4 quadranti) | idem |
| `erpv6.matrix5s.assessment` | `res_model`, `res_id`, `area` (Char libero, non hardcoded — pensato per essere estendibile ad altri verticali), `line_ids` | idem |
| `erpv6.matrix5s.line` | `assessment_id`, `fase` (Selection 1S-5S), `azione_tipica`, `spreco_identificato`, `guadagno_potenziale`. Vincolo SQL: una riga per fase per assessment | idem |
| `erpv6.heinrich.indicator` | `res_model`, `res_id`, `near_miss_segnalati`, `problemi_lievi`, `eventi_gravi`, `cultura_organizzativa` (compute: euristica Toyota/Ford basata su rapporto 1:29:300) | idem — presente nel modulo ma non citato nel template originale |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`get_current_phase(project_id)`** → non esiste nel codice. Grep su tutto il repo (`odoo-modules/`, `apps/`): zero occorrenze. Puramente concettuale, non implementato. Segnalato come dato mancante (`flagged_missing_data`) invece di inventare una firma plausibile.
- **`compute_pareto()`** su `erpv6.pareto.analysis` → unico metodo pubblico reale, richiamabile da altri moduli o da bottone UI. Ordina gli item, calcola percentuale cumulata, marca `is_priority`.
- Kairós, 5S, Heinrich non hanno metodi pubblici: la logica gira interamente su `@api.depends` (compute automatico al salvataggio), non c'è un'API esplicita da chiamare — solo lettura/scrittura campi.

## Punti di estensione noti

- Pattern `res_model`/`res_id`: aggancio generico a qualsiasi record Odoo (crm.lead, res.partner, sale.order, ecc.) — vero punto di estensione trasversale, usato coerentemente su tutti e 5 i modelli.
- `matrix5s.area` (Char libero) è l'estensione corretta: nuove dimensioni per nuovi verticali si aggiungono senza toccare codice.
- `kairos.matrix_type` invece è una Selection con solo 2 valori hardcoded — per aggiungere un terzo tipo serve una modifica al modello, non è puro dato. Incoerenza rispetto al principio motore/conoscenza del CLAUDE.md.
- Cosa NON toccare: la logica di calcolo (soglia 80/20 di Pareto, matrice quadranti Kairós, euristica 1:29:300 di Heinrich) è il "motore" a-settoriale — le regole di settore vanno in `erpv6_kb` con `verticale` valorizzato (campo verificato in `erpv6_kb/models/kb_category.py`), ma nessun modello di `erpv6_methodology` referenzia oggi `erpv6_kb` — il collegamento è un principio architetturale dichiarato, non ancora implementato nel codice.
- `erpv6_kaizen` → `erpv6_opportunity` → `erpv6_bandi`: questi moduli (kaizen, opportunity) non esistono ancora nel repo (esistono solo `erpv6_validation` e `erpv6_bandi`). La regola di orchestrazione del CLAUDE.md descrive un'architettura futura, non lo stato attuale.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` sul VPS: `erpv6_methodology` risulta `state=installed`, `latest_version=18.0.1.0.0`, coerente col manifest. File su VPS (`/opt/erpv6/custom-addons/erpv6_methodology`) identici byte-per-byte al repo.
- Zero dati reali: tutte e 6 le tabelle (`pareto_analysis`, `pareto_item`, `kairos_matrix`, `matrix5s_assessment`, `matrix5s_line`, `heinrich_indicator`) hanno 0 righe. Il modulo è installato ma non è mai stato usato in produzione.
- Unico consumer: `erpv6_api_gateway/controllers/methodology_api.py` — 11 endpoint REST (`/api/v1/methodology/{pareto,kairos,5s,heinrich}`), GET list/detail + POST create, e POST compute solo per Pareto.

### Debiti noti / TODO

- Nessun test automatico (nessuna cartella `tests/`).
- API gateway non ha endpoint di update (PATCH/PUT) o delete per nessuna delle 5 risorse — CRUD incompleto.
- `matrix_type` di Kairós hardcoded (vedi sopra).
- Nessun collegamento a `erpv6_kb` nonostante il principio architetturale lo preveda.
- `get_current_phase` non implementato.
- Nota storica: il 12/08/2026 la promozione di questo modulo ha rivelato un bug nello script `promote_module.sh` (ordine copy/verify) — non un difetto del modulo, ma è annotato nei commenti dello script.
