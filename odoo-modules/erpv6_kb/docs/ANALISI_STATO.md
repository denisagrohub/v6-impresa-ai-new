# erpv6_kb — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.kb` | `name`, `description`, `kb_type` (Selection, 7 valori — vedi bug sotto), `category_id`, `tag_ids`, `brand_id` (link a `erpv6_consulting`), `priority` (0-10), `content`, `content_format`, `is_encrypted`, `checksum` (compute SHA256), `access_level` (public/consultant/ai_only/admin), `allowed_user_ids`, `embedding`, `use_context`, `related_article_ids` (M2M ricorsiva), `parent_id`/`child_ids` (gerarchia), `normalized_data`, `use_count`, `last_used`, `last_used_by`, `source`, `valid_from`/`valid_to`, `is_active` | Modello centrale, con logica reale non banale: cifratura automatica in `create`/`write`, versionamento (via `erpv6.version.mixin`), filtro automatico di validità temporale nel `search()` override |
| `erpv6.kb.category` | `name`, `kb_type`, `parent_id`/`child_ids`, `default_ttl_hours`, `is_transversal`, `verticale` (con vincolo di esclusività reciproca) | Il meccanismo con cui, secondo CLAUDE.md, la conoscenza di settore dovrebbe essere aggiunta senza duplicare codice nei motori generici |
| `erpv6.kb.tag` | `name`, `color`, `active`, `article_count` (compute) | Anagrafica semplice |
| `erpv6.kb.engine` | `name`, `active` | Motore di processing con dispatcher per `kb_type` (vedi bug sotto) |
| `erpv6.kb.normalizer` | Nessun campo persistente oltre a `_name`/`_description` | Motore di estrazione concetti/normalizzazione, nessuno stato proprio |
| `erpv6.kb.request` | `name`, `sector`, `category`, `tags`, `heinrich_level` (Selection red/yellow/green — riusa la terminologia Heinrich vista in `erpv6_methodology`, ma come campo indipendente, non collegato al modello `erpv6.heinrich.indicator`), `reason`, `context`, `status` (pending/accepted/rejected/completed), `priority`, `kb_id`, `detection_count` | Traccia le richieste di KB mancante, generate automaticamente da `kb.engine` quando non trova contenuto adatto |
| `erpv6.kb.usage` | `kb_id`, `user_id`, `date`, `action` (view/use/process), `context`, `duration` | Modello di log, definito ma **mai scritto da nessun metodo del modulo** (vedi sotto) |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.kb.get_content_for_ai(ai_name='unknown')` — punto di accesso principale al contenuto (gestisce controllo accessi e decifratura). Richiamato internamente da `kb.engine` e `kb.normalizer`.
- `erpv6.kb.action_show_content()` / `action_log_usage(ai_name='manual')` — bottoni UI (`type="object"`, verificati in `views/kb_views.xml`).
- `erpv6.kb.engine.process(kb_id, input_data)` — **unico metodo del modulo confermato chiamato da un modulo esterno**: `erpv6_color/models/color.py` (`action_generate_palette`) lo richiama per generare palette colori a partire da una KB con `kb_type='colori'`.
- `erpv6.kb.normalizer.normalize(kb_id, raw_input=None)` — pubblico, ma **nessun consumer trovato in tutto il repo**, nemmeno all'interno di `erpv6_kb` stesso: nessuna chiamata a `self.env['erpv6.kb.normalizer']` da nessuna parte. Codice presente ma non attualmente invocato da nulla.
- `erpv6.kb.request.create_from_gap(...)`, `action_accept()`, `action_reject()`, `action_complete(kb_id)` — usati internamente da `kb.engine._handle_missing_kb`/`_handle_generic_kb`; nessun consumer esterno al modulo trovato.

## Punti di estensione noti

- `erpv6.kb.category` con `is_transversal`/`verticale` è esattamente il meccanismo descritto in CLAUDE.md per distinguere conoscenza trasversale da conoscenza di settore — **corretto e coerente con l'architettura dichiarata**.
- **Bug reale verificato nel codice**: `KB_TYPE_SELECTION` (in `kb_knowledge.py`) ammette solo questi 7 valori: `fiscale`, `psicologico`, `normativo`, `industriale`, `artigianale`, `prompt`, `metodo_v6`. Il dispatcher in `kb_engine.py._process_kb` invece smista in base a `kb.kb_type` usando le chiavi `psicologia`, `colori`, `metodi`, `regole`, `storytelling`, `commerciale` — **nessuna di queste chiavi coincide con un valore ammesso dalla Selection** (nemmeno `psicologico` vs `psicologia`, che sono stringhe diverse). Conseguenza verificata: per qualunque record `erpv6.kb` creabile realmente tramite l'interfaccia standard, `_process_kb` cade sempre nel branch di default (`_process_default`), e i processori specializzati (`_process_psychology`, `_process_colors`, ecc.) non vengono mai eseguiti in pratica.
- Coerentemente, `erpv6_color/models/color.py` cerca una KB con `kb_type='colori'` — valore che **non è nella Selection e quindi non può essere impostato da UI standard**: il flusso di generazione palette descritto nel codice di `erpv6_color` non può funzionare come scritto, a meno che il valore non venga forzato via SQL diretto o import, bypassando la Selection. Questo non è un'illazione: è la conseguenza diretta del confronto tra i due file di codice.
- `erpv6.kb.usage` è definito con relazione `ondelete='cascade'` verso `erpv6.kb` ma **nessun metodo del modulo crea record di questo modello** — il tracking d'uso reale avviene invece tramite i campi `use_count`/`last_used`/`last_used_by` direttamente su `erpv6.kb` (in `get_content_for_ai` e `action_log_usage`). Il modello `erpv6.kb.usage` sembra un log più granulare pensato ma non collegato.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_kb` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) coincide con la versione installata: nessun drift rilevato.
- **Falla di sicurezza/accesso verificata**: `security/ir.model.access.csv` definisce diritti di accesso **solo** per `erpv6.kb`, `erpv6.kb.category`, `erpv6.kb.tag`. Non esiste alcuna riga per `erpv6.kb.engine`, `erpv6.kb.normalizer`, `erpv6.kb.request`, `erpv6.kb.usage` — questi 4 modelli non hanno diritti di accesso dichiarati, quindi un utente non-superuser che provi ad accedervi senza `sudo()` otterrebbe un errore di permessi (comportamento standard Odoo per modelli senza `ir.model.access` righe). Il codice che li usa (`kb_engine.process`, chiamato da `erpv6_color`) non applica `.sudo()` esplicitamente su queste chiamate — dato da verificare a runtime, ma la configurazione di sicurezza attuale è incompleta rispetto ai modelli effettivamente definiti.
- Consumer reali confermati: `erpv6_api_gateway/controllers/kb_api.py` (2 endpoint REST, solo GET: lista e dettaglio articoli), `erpv6_omni_bridge`, `erpv6_bandi`, `erpv6_color`, `erpv6_typst`, `erpv6_package`, `erpv6_deep_source` — tutti referenziano `erpv6.kb.*` nel codice, non solo nel manifest.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- Mismatch reale e verificato tra `KB_TYPE_SELECTION` e le chiavi del dispatcher in `kb_engine.py` — i processori specializzati (psicologia, colori, metodi, regole, storytelling, commerciale) sono di fatto irraggiungibili con i valori Selection attuali.
- 4 modelli (`kb.engine`, `kb.normalizer`, `kb.request`, `kb.usage`) senza righe in `ir.model.access.csv`.
- `erpv6.kb.normalizer.normalize()` non ha alcun chiamante nel repository.
- `erpv6.kb.usage` definito ma mai popolato da nessun metodo.
- Nessun test automatico per un modulo con logica non banale (cifratura, versionamento, controllo accessi).
