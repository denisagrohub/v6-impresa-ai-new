# erpv6_package — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.package.custom` | `name`, `partner_id`, `module_ids` (M2M), `total_price`/`final_price` (compute), `discount`, `status` (draft/confirmed/sold), `aggregated_interview` (compute: unione deduplicata delle `interview_questions` dei moduli selezionati), `aggregated_required_fields` (compute: merge dei JSON Schema `required_fields`), `document_style` (Selection: minimal/strafigo) | Modello con logica di aggregazione reale, non solo anagrafica |
| `erpv6.package.module` | `name`, `code`, `price`, `description`, `is_active`, `required_fields` (Json, JSON Schema), `interview_questions` (Text), `generation_prompt_kb_id` (M2O `erpv6.kb`, dominio `kb_type='prompt'`), `typst_template_id` (M2O `erpv6.typst.template`) | Anagrafica di "moduli di servizio" venduti, collegata a generazione documentale AI |
| `erpv6.package.generate.metadata.wizard` (`TransientModel`) | `package_module_id`, `typst_template_id` | Wizard con un solo metodo (`action_generate`) — **vedi bug critico sotto** |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`action_generate()`** sul wizard — pensato per generare via AI i metadata (`required_fields`, `interview_questions`, prompt) partendo da un template Typst. **Bug reale confermato nel codice**: alla riga `generate_module_metadata_wizard.py:75-85`, chiama `omni_bridge.execute_ai_task(...)` e poi esegue `json.loads(result_json_str)` sul valore restituito. Ma `execute_ai_task()` (in `erpv6_omni_bridge/models/omni_bridge.py`) **restituisce un dizionario Python** (`{'success': bool, 'data': ..., 'error': ...}`), non una stringa JSON. `json.loads()` su un `dict` solleva `TypeError`, non `json.JSONDecodeError` — l'unico blocco `except` presente cattura solo `JSONDecodeError`, quindi il `TypeError` non verrebbe gestito e il wizard andrebbe in crash non gestito ogni volta che viene eseguito. Non è un'ipotesi: è verificabile confrontando la firma di ritorno reale di `execute_ai_task` con l'uso che ne fa questo wizard.
- Nessun altro metodo pubblico rilevante nei due modelli principali (solo `@api.depends` compute).

## Punti di estensione noti

- `required_fields` (Json libero, JSON Schema) e `generation_prompt_kb_id` (link a `erpv6.kb` con `kb_type='prompt'`) sono un punto di estensione corretto: nuovi moduli di servizio si aggiungono come dati, non come codice — coerente col principio motore/conoscenza.
- Il manifest dichiara esplicitamente (commento) di aver verificato l'assenza di dipendenze circolari nella catena `erpv6_typst → erpv6_bandi → erpv6_deep_source → erpv6_kb` prima di aggiungere `erpv6_typst` ed `erpv6_kb` come dipendenze — buona pratica documentata nel codice stesso.
- Non pertinente ai principi di orchestrazione Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.1.0.0`. Coincide col `version` nel `__manifest__.py` locale — nessun drift.
- **Il wizard `erpv6.package.generate.metadata.wizard` non è raggiungibile da UI**: il manifest dichiara solo `security/ir.model.access.csv` e `views/package_views.xml` in `data` — non esiste nessuna vista/azione/menu per il wizard in tutto il modulo, né un bottone che lo richiami altrove nel repo. È un `TransientModel` completo, mai istanziabile dall'interfaccia utente.
- `erpv6.package.module` non ha una propria vista list/form dedicata: `package_views.xml` mostra solo il form di `erpv6.package.custom` (con `module_ids` come `many2many_tags`) — i campi avanzati (`required_fields`, `interview_questions`, `generation_prompt_kb_id`, `typst_template_id`) non sono editabili da nessuna vista esistente.
- `erpv6.package.custom` è consumato realmente da `erpv6_contract` (`package_id = fields.Many2one('erpv6.package.custom')`) — quindi la parte "vendita pacchetto" del modulo è collegata al resto del sistema, a differenza della parte "generazione metadata AI".
- `get_typst_source()` (chiamato dal wizard) esiste realmente in `erpv6_typst/models/typst_template.py:139` — quella dipendenza è valida, il problema è solo nel parsing del risultato AI.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Bug critico**: `action_generate()` del wizard crasha con `TypeError` non gestito ad ogni esecuzione (mismatch tipo dict/str tra `execute_ai_task` e il parsing `json.loads`) — la feature "generazione automatica metadata pacchetto da template Typst" è di fatto non funzionante allo stato attuale del codice.
- **Feature irraggiungibile**: anche correggendo il bug sopra, il wizard non ha nessuna vista/menu che lo esponga in UI — va aggiunta la parte di interfaccia prima che sia utilizzabile.
- Nessuna vista dedicata per `erpv6.package.module` — i campi di integrazione Typst/KB non sono gestibili da interfaccia.
- Nessun test automatico.
- Nel codice del wizard c'è un commento esplicito `# DUBBIO:` dell'autore originale riguardo all'assenza di una categoria KB predefinita per i prompt di generazione — il codice risolve creandola al volo se mancante, comportamento dichiarato ma non discusso/validato architetturalmente.
