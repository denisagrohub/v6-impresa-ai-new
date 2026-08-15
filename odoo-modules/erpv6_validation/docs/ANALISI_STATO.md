# erpv6_validation — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

Questo è il motore "6 Giudici" citato nel `CLAUDE.md` del progetto come motore generico di validazione anti-allucinazione. Le affermazioni del CLAUDE.md sono state verificate riga per riga contro il codice reale (non date per scontate).

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.validation.session` | `res_model`, `res_id`, `destinatario`, `scopo`, `context_data` (Json), `validation_mode` (Selection: sesto_only/full_six_judges), `status` (draft/in_validation/converged/escalated_to_human/human_reviewed/approved/rejected), `max_rounds` (default 5), `round_ids`, `current_round_number` (compute), `human_reviewer_id`, `human_reviewed_at`, `human_notes` | Motore di orchestrazione reale, non anagrafica |
| `erpv6.validation.round` | `session_id`, `round_number`, `analysis_ids`, `issues_found`, `sesto_uomo_notes`, `corrected_material` (Json) | Dati reali per round |
| `erpv6.validation.analysis` | `round_id`, `analyst_index` (Selection 1-5 + sesto), `omni_call_log_id` (Many2one `erpv6.omni.call.log`), `findings`, `claims_checked` (Json), `flagged_missing_data` | Traccia ogni singola analisi AI, con tracciabilità costi via `erpv6_omni_bridge` |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.validation.session.action_start_validation()`: avvia la sessione (richiede stato `draft`), pensato per bottone UI o chiamata programmatica da altri moduli.
- `action_human_approve()` / `action_human_reject(reason)`: chiudono la sessione dopo revisione umana.
- `_run_round()` è privato (prefisso `_`) ma contiene tutta la logica di orchestrazione — non pensato per essere chiamato dall'esterno.
- **Consumer reale verificato**: `erpv6_api_gateway/controllers/validation_api.py` espone questo modello via REST (confermato con grep incrociato) — è l'unico punto di accesso esterno oggi.
- **Nessun modulo Kaizen lo chiama**, perché `erpv6_kaizen` non esiste ancora nel repository (vedi sotto). Il collegamento descritto nel CLAUDE.md ("proposte Kaizen legate a CCP richiedono sempre passaggio da erpv6_validation") è quindi un principio architetturale dichiarato per il futuro, non un flusso già cablato nel codice.

## Punti di estensione noti

- `res_model`/`res_id` generico: la sessione di validazione può essere agganciata a qualsiasi record Odoo, coerente col principio motore a-settoriale.
- `validation_mode` è una Selection con solo 2 valori (`sesto_only`, `full_six_judges`) — estensione futura (es. un numero variabile di analisti) richiederebbe modifica al codice, non è dato puro. Accettabile dato che il numero "5 Analisti + Sesto Uomo" è il nome stesso del metodo, non un dettaglio implementativo casuale.
- Dipende da `erpv6_omni_bridge` per l'esecuzione reale delle chiamate AI (`execute_ai_task`) — verificato che il metodo esiste davvero in `erpv6_omni_bridge/models/omni_bridge.py`. Buona separazione delle responsabilità (motore di validazione vs motore di chiamata AI).

### Verifica specifica richiesta: `max_rounds` ed `escalated_to_human`

**Confermato nel codice, corrisponde esattamente a quanto descritto nel CLAUDE.md:**

- `max_rounds` esiste come campo Integer con `default=5` (`validation_session.py` riga 35) — combacia con "max_rounds di sicurezza (default 5)".
- In `_run_round()`: se `round_number > session.max_rounds` all'inizio del metodo, o se `round_number >= session.max_rounds` dopo l'analisi del Sesto Uomo con problemi ancora aperti, lo stato passa a `'escalated_to_human'` — combacia con "se non converge, stato escalated_to_human".
- Non c'è possibilità di loop infinito: il controllo `round_number > max_rounds` è la prima istruzione di `_run_round()`, e la ricorsione (`session._run_round()` alla fine, quando `issues_found > 0` e non si è ancora raggiunto il limite) è quindi limitata in profondità dal valore di `max_rounds` — combacia con "mai loop infinito".

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`, `latest_version: 18.0.1.0.0` — coincide con `version` nel `__manifest__.py` locale. Nessun drift.
- `security/ir.model.access.csv` ha `group_id` vuoto per le righe "user" (nessuna colonna gruppo compilata) — significa che quelle regole si applicano a tutti gli utenti autenticati senza restrizione di gruppo specifico, non solo a `base.group_user`. Comportamento intenzionale plausibile ma non commentato nel CSV.
- `erpv6_kaizen` e `erpv6_opportunity`, i moduli che secondo il CLAUDE.md dovrebbero essere i principali consumer di questo motore per le proposte CCP/fiscali, **non esistono nel repository** — verificato con `find`/`ls` su `odoo-modules/`. Il flusso descritto nel CLAUDE.md è quindi ancora da costruire.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- Nessun test automatico, nonostante sia un motore critico per l'anti-allucinazione del progetto.
- Il flusso di orchestrazione Kaizen → Validation descritto nel CLAUDE.md non è ancora implementato in nessun modulo esistente — non è un debito di questo modulo specifico, ma un gap architetturale a monte da tenere presente.
- `_run_round()` è ricorsivo (si richiama da solo fino a convergenza o escalation): con `max_rounds` default a 5 il rischio è basso, ma se `max_rounds` venisse impostato a un valore molto alto in futuro, la ricorsione Python (non un ciclo iterativo) potrebbe avvicinarsi ai limiti di stack — non un problema oggi, ma un dettaglio implementativo da tenere a mente se il limite di sicurezza venisse mai alzato.
