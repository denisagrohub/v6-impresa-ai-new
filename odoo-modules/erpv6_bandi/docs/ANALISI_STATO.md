# erpv6_bandi — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.bando` | `name`, `code` (unique), `source_id`, `ente`, `importo_max`, `tipo_agevolazione` (Selection 5 valori), `scadenza_domanda/erogazione`, `settori_target` (Char libero), `area_geografica` (Selection), `status` (draft/active/expired/closed, tracking), `match_count`/`application_count` (compute), `kb_module_id`, `last_sync` | Modello centrale, eredita `erpv6.core.tracked`, con logica di business reale |
| `erpv6.bando.match` | `bando_id`, `partner_id`, `project_id` (crm.lead), `eligibility_score` (Float), `eligibility_level` (compute: high/medium/low su soglie 80/60), `status` (new/notified/interested/applied/rejected/won), `consultant_id` (con domain **rotto**, vedi debiti) | Modello di matching — vedi sotto: la parte "intelligente" non è implementata |
| `erpv6.bando.application` | `match_id`, `bando_id`/`partner_id` (related da match), `application_date`, `amount_requested`/`funded_amount`, `status` (draft→submitted→under_review→approved/rejected→funded) | Workflow candidatura completo e funzionante |
| `erpv6.bando.source` | `name`, `url`, `source_type` (Selection), `api_endpoint`, `api_key`, `last_scrape`, `scrape_interval_hours` | Configurazione fonti di scraping, con logica reale di integrazione (vedi sotto) |
| Estensione `res.partner` | `bandi_match_ids`, `bandi_interested_count`/`applied_count`/`won_count` (compute), `total_funded_amount` (compute) | Solo lettura/aggregazione, nessuna logica propria |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.bando`: `action_search_updates()` (delega a `source_id.action_scrape_now()`), `action_validate()` (salva il bando in `erpv6.kb.module` cifrato), `action_expire()`, `action_open_matches()`, `action_open_applications()`. Tutti richiamati da bottoni UI (`type="object"`), nessuno chiamato da altri moduli via codice.
- `erpv6.bando.match`: `action_notify_consultant()` (invia mail template), `action_mark_interested()`, `action_create_application()`. Solo da UI.
- `erpv6.bando.source`: **`action_scrape_now()`** è il metodo con più logica del modulo — orchestrazione reale multi-modulo: crea/recupera `erpv6.deep.source.config`, chiama `erpv6.deep.source.engine.search_and_extract()` (modulo `erpv6_deep_source`), decifra con `erpv6.crypto.engine` (modulo `erpv6_crypto`) se necessario, fa il parsing JSON e crea record `erpv6.bando`. Richiamato sia da UI sia da cron (`_cron_scrape_all`, schedulato in `data/bandi_cron.xml`).
- **Nessun metodo di questo modulo è chiamato da altri moduli erpv6 via import/riferimento diretto in Python** — l'unico consumo esterno verificato è dai due controller REST (uno interno al modulo, uno nel gateway, vedi sotto).

## Punti di estensione noti

- `settori_target` è un Char libero (non Selection) — coerente con l'estendibilità multi-verticale.
- Rispetta il principio "motore vs conoscenza" nel percorso di scraping: la logica di estrazione/scraping generica è delegata a `erpv6_deep_source`, e i dati vengono salvati cifrati in `erpv6_kb` — `erpv6_bandi` orchestra ma non duplica motori generici.
- **Punto critico rispetto al CLAUDE.md**: la regola del progetto dice che `erpv6_kaizen` non deve parlare mai direttamente con `erpv6_bandi`, ma passare da `erpv6_opportunity`. Verificato con grep: nessun riferimento a "kaizen" o "opportunity" nel codice di questo modulo — e questi due moduli non esistono ancora nel repo (vedi analisi di `erpv6_methodology`). La regola di orchestrazione è quindi non ancora rilevante/applicabile: `erpv6_bandi` oggi non ha alcun collegamento (né corretto né scorretto) con kaizen/opportunity, perché questi ultimi non esistono.
- Due superfici API parallele e incoerenti: `erpv6_bandi/controllers/bandi_api.py` espone rotte `/api/v6/bandi/*` (`type='json'`, `auth='user'`), mentre `erpv6_api_gateway/controllers/bandi_api.py` espone rotte diverse `/api/v1/bandi/*` (`type='http'`, `auth='none'`) con logica duplicata scritta in modo indipendente. Non è chiaro quale sia quella "ufficiale" da usare — nessun commento nel codice lo chiarisce.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.1.0.0`. Coincide con la versione nel manifest locale — nessun drift.
- Dipende da `erpv6_deep_source`, `erpv6_kb`, `erpv6_consulting`, `erpv6_core` (dichiarati e usati realmente nel codice, non solo dichiarati a vuoto).
- Ha dati demo (`demo/bandi_demo.xml`), quindi è pensato per essere popolato e testato.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Bug reale verificato — funzionalità core mai implementata**: `eligibility_score` (il cuore del "matching intelligente" descritto nel manifest) non viene MAI scritto da nessuna parte del codice — è solo letto, ordinato e filtrato nei controller. Il metodo `_compute_eligibility()` in `bando_match.py` esiste ma è uno stub vuoto (`pass`, con commento `"Questa logica verrà implementata con l'integrazione completa"`) e **non è nemmeno collegato con `@api.depends`** — non viene mai chiamato automaticamente né manualmente da nessun bottone. Tutti i punteggi di eleggibilità nel sistema sono e restano 0 finché qualcuno non li scrive manualmente.
- **Bug reale verificato — import mancante**: `bando_match.py` usa `raise UserError(...)` in `action_notify_consultant()` ma importa solo `from odoo import models, fields, api, _` — manca `from odoo.exceptions import UserError`. Il percorso di errore (consulente senza email) solleverebbe `NameError` invece di un errore utente pulito.
- **Bug reale verificato — campo inesistente in un domain**: `consultant_id` in `bando_match.py` ha `domain=[('is_consultant', '=', True)]`, ma il campo `is_consultant` **non esiste** su `res.partner` in nessun modulo del repo — l'unico campo simile è `x_pi_is_consultant`, definito in `erpv6_booking` con nome diverso. Questo domain, se valutato dalla UI, genererebbe un errore di campo inesistente. Lo stesso identico bug è presente anche in `erpv6_omni_bridge/models/omni_call_log.py` — è un problema cross-modulo, non isolato.
- Due controller REST paralleli e incoerenti per lo stesso dominio (vedi sopra) — duplicazione di logica, superficie di manutenzione doppia.
- Nessun test automatico.
