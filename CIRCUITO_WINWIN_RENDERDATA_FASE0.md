# Circuito `erpv6_winwin_renderdata` — FASE 0 (verifica, sola lettura)

Verifica eseguita il 2026-09-05 sui due punti richiesti prima di avviare la Fase 1 (creazione struttura KB soglie). Nessuna modifica effettuata.

---

## 1. Struttura KB per soglie metriche finanziarie

**`erpv6.kb.category`** (campi reali via `_fields`): `name, kb_type, description, parent_id, child_ids, sequence, color, active, article_count, default_ttl_hours, is_transversal, verticale`. Pura tassonomia — nessun campo numerico, nessuna banda verde/ambra/rosso. Scorse le ~90 categorie reali nel DB: nessuna contiene soglie numeriche in nessuna forma strutturata (confermato: zero precedenti).

**`erpv6.kb.engine`** (campi reali): solo `name, active` — nessuno stato di configurazione, tutta la logica è nei metodi Python (`kb_engine.py`). Il dispatcher `_process_kb` ha un dizionario `processors` che include già `_process_rules` (righe 39-41: legge `data.get('rules', [])` da un JSON in `kb.content` e lo ritorna grezzo) — **ma è irraggiungibile oggi**: `kb_type` è un `Selection` chiuso (`KB_TYPE_SELECTION` in `kb_knowledge.py:6-19`) che NON contiene `'regole'` come valore valido (verificato coi `kb_type` realmente presenti in produzione: `metodo_v6, psicologico, changelog_tecnico, industriale, prompt, colori, disc_assessment, normativo` — `'regole'` non c'è). `_process_rules` non farebbe comunque banding verde/ambra/rosso: ritorna solo la lista grezza, il match numero→banda andrebbe scritto.

**Precedente diretto trovato — e più recente/rilevante di quanto sopra**: `erpv6_disc_assessment` (30/08/2026, commentato esplicitamente "primo Motore NATIVO") ha scelto di **non** estendere `erpv6.kb.engine` ("quel dispatcher ha un elenco chiuso... estenderlo avrebbe voluto dire toccare erpv6_kb, fuori scope" — `aeosv6_dispatch.py:14-18`), e usa invece **`erpv6.core.kb_link`** (già esistente in `erpv6_core_engine`, il "Rombo KB" del vocabolario AEOSv6): un nodo motore ha `kb_link_ids`, ciascuno con `resolution_mode` (`fixed_kb`= pin diretto a un `erpv6.kb`, o `dynamic`=`find_best_for()`), e `resolve_kb()` (righe 100-120) ritorna il record `erpv6.kb` pronto da leggere. Il motore legge poi `kb.content` (JSON) direttamente in Python, self-contained.

**Conclusione punto 1**: nessun modello nuovo serve. Il percorso a minor attrito, coerente col precedente più recente del progetto, è:
1. Una nuova `erpv6.kb.category` ("Soglie Metriche Finanziarie", dato puro, zero codice)
2. Un `erpv6.kb` (`content_format='json'`, contenuto = bande soglia per DSCR/leva con riferimento)
3. Collegare il nodo AEOSv6 del circuito a quella KB via `erpv6.core.kb_link` (`resolution_mode='fixed_kb'`)

Il piccolo pezzo di codice non evitabile è il confronto valore-osservato→banda (non esiste oggi un `get_regime_for_ateco`-equivalente generico per bande numeriche) — va scritto nel Motore, ma legge le soglie da dato, mai hardcoded.

## 2. Slot-filling KB→azione win-win

**Non esiste — non trovato, in nessuna forma, né come motore né come modello dati pronto.** Cercato "slot"/"slot_filling" in tutto `odoo-modules/`: zero hit pertinenti (gli unici 2 match, in `booking_api.py` e `erpv6_booking/models/res_partner.py`, sono time-slot di prenotazione appuntamenti, concetto non correlato). `erpv6_methodology` contiene solo motori di scoring (`kairos_matrix`, `heinrich_indicator`, `matrix5s_*`, `pareto_*`) — nessun meccanismo di template+placeholder.

**Quello che esiste davvero per "azioni win-win" è un meccanismo diverso, non uno slot-filling**: `erpv6_production/data/kb_metodo_winwin_disc_data.xml` definisce un metodo **generativo AI puro** — un prompt testuale libero (`kb_type='metodo_v6'`, KB id `kb_metodo_analisi_winwin`) instradato via `erpv6.omni.route.config` (`task_type='winwin_analysis_generation'`), eseguito da `production_order.py:1205` `_run_metodo_ai('winwin')` (bottone manuale `action_genera_analisi_win_win`, riga 1160). Il prompt chiede a un LLM di generare `azioni_winwin` come JSON libero dai dati reali dell'intervista, con regole anti-allucinazione **scritte dentro il testo del prompt** (non garantite da una struttura dati) e un campo `flagged_missing_data` che l'AI si autoregola a compilare — non un'estrazione deterministica guidata da template/slot.

**Verificato anche**: questo metodo (a) è un'azione manuale, non è agganciato alla pipeline `_build_typst_data`/render_data; (b) il suo output viene salvato come `erpv6.library.document` generico e **non passa mai da `erpv6.validation`** — nessuna verifica strutturale dopo la generazione AI.

**Conclusione punto 2**: quello che il circuito userebbe per "azioni win-win" non è slot-filling ma un motore AI-generativo già esistente e funzionante tecnicamente, ma con un profilo di rischio diverso da quello richiesto dal circuito (anti-allucinazione affidata al prompt, non a un gate strutturale, e nessun passaggio da `erpv6.validation` oggi). Se il circuito vuole il principio "gate obbligatorio, mai bypassabile" della Fase 3, **questo output va instradato nel gate `erpv6.validation` per la prima volta**, non riusato così com'è.

---

## Riepilogo per decisione prima della Fase 1

| Componente | Stato | Percorso minor attrito |
|---|---|---|
| Storage soglie DSCR/leva | Non esiste | 1 `erpv6.kb.category` + 1 `erpv6.kb` (dato) + `erpv6.core.kb_link` (fixed_kb) — riuso totale, zero modelli nuovi |
| Confronto valore→banda | Non esiste | Piccolo metodo nel Motore, soglie lette da KB |
| Slot-filling azioni win-win | Non esiste (era un'ipotesi, non trovata) | Il meccanismo reale trovato è generativo AI (`_run_metodo_ai`), non slot-filling — riusabile ma va fatto passare per la prima volta da `erpv6.validation` |

Nessuna modifica effettuata (sola lettura, come richiesto). In attesa di conferma prima di avviare la Fase 1.
