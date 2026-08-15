# erpv6_marketing — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.naming.candidate` | `brand_project_id` (M2O `erpv6.brand.project`, required), `name`, `rationale`, `memorability_score` (1-10), `domain_available` (Selection), `is_selected` | Modello proprio del modulo — anagrafica + punteggio, nessuna logica di compute |
| `erpv6.brand.project` (estensione via `_inherit`, in due file diversi: `logo_generator.py` e `marketing.py`) | Aggiunge `naming_candidate_ids` (One2many) e 3 metodi di generazione (naming, logo bozza, logo AI) | Non è un modello proprio — solo estensione di `erpv6_brand` |

Il modulo non ha modelli anagrafici propri oltre a `erpv6.naming.candidate`: è essenzialmente un pacchetto di **azioni AI-driven** aggiunte al progetto brand.

## Metodi pubblici pensati per essere chiamati da altri moduli

Tutti e 3 i metodi seguenti sono richiamati realmente da bottoni in `views/brand_project_naming_views.xml` (verificato) — nessuno è codice morto:

- **`action_generate_naming_candidates(count=10)`** — chiama `erpv6.omni.bridge.execute_ai_task(task_type='naming_generation', ...)`, fa parsing del JSON restituito dall'AI e crea record `erpv6.naming.candidate`.
- **`action_generate_logo_draft()`** — genera un SVG algoritmico deterministico (NON via AI, hash MD5 del nome → forma geometrica), lo salva come `erpv6.library.document` (categoria `brand_logo`).
- **`action_generate_logo_ai()`** — chiama `erpv6.omni.bridge.execute_ai_task(task_type='logo_generation_ai', ...)`, richiede un `erpv6.omni.provider` con `provider_type='image'` attivo; se assente solleva `UserError` esplicito invece di procedere con credenziali inventate (coerente con la regola anti-allucinazione del progetto).

Nessun altro modulo nel repo chiama questi 3 metodi — sono pensati per essere usati solo da UI (bottoni), non da altri moduli.

## Punti di estensione noti

- Dipende correttamente da `erpv6_omni_bridge` per ogni chiamata AI (nessuna chiamata diretta a provider esterni nel codice del modulo) — rispetta il principio di passare da un motore generico invece di duplicare integrazioni AI.
- `task_type` (`'naming_generation'`, `'logo_generation_ai'`) sono stringhe libere passate a `execute_ai_task` — l'estensione a nuovi task type non richiede modifiche a `erpv6_omni_bridge`, ma richiede che il provider/routing corrispondente sia configurato lì (dato di configurazione, non di codice).
- Non pertinente ai principi di orchestrazione Kaizen/Opportunity/Bandi/Validation del CLAUDE.md — questo modulo non tocca quel dominio.

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.1.0.0`. Coincide col `version` nel `__manifest__.py` locale — nessun drift.
- Modulo consumato attivamente lato codice: dipende da `erpv6_brand`, `erpv6_library`, `erpv6_omni_bridge`; le sue 3 azioni sono raggiungibili da UI.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Possibile bug di permessi**: `security/ir.model.access.csv` dà a `base.group_user` solo `perm_read=1` su `erpv6.naming.candidate` (`perm_write=0, perm_create=0, perm_unlink=0`). Ma `action_generate_naming_candidates()` esegue `self.env['erpv6.naming.candidate'].create(...)` **senza `.sudo()`**. Se l'azione viene eseguita da un utente che appartiene solo a `base.group_user` (non `base.group_system`), la create dovrebbe fallire con `AccessError` — non verificato a runtime (nessun accesso a log applicativi in questa analisi), ma è un'incoerenza reale visibile nel codice tra permessi dichiarati e comportamento del metodo.
- Nessun test automatico.
- Parsing della risposta AI in `action_generate_naming_candidates` si basa su un formato JSON specifico atteso nel testo libero restituito dal modello (con pulizia regex di eventuali backtick markdown) — fragile per costruzione se il provider AI cambia formato di risposta, ma è un limite intrinseco dichiarato nel codice stesso, non un bug silente.
