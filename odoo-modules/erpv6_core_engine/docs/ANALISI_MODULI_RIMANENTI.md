# Analisi EAOSv6 — moduli rimanenti (in corso, 29/08/2026)

Solo analisi (Motore/KB/Output/Gate/Cron secondo `ARCHITETTURA_AEOSV6.md`) — nessuna
sostituzione automatica, per decisione esplicita di Denis. Ogni sezione arriva da un
agente in background, lanciato in parallelo per gruppi di moduli indipendenti.

Già decomposti prima di questo documento (non ripetuti qui): `erpv6_color`,
`erpv6_contract`/`erpv6_sign`, `erpv6_tracking`, `erpv6_library`, `erpv6_kaizen`.

Stato: **COMPLETO** (29/08/2026, 22:xx) — tutti i moduli rimanenti analizzati, inclusi i
rilanci dopo il rate limit del pomeriggio. Documento pronto per revisione/email.

---

# Gruppo A — 9 moduli piccoli

Metodo: lettura integrale di ogni file .py/manifest/ir.model.access.csv, verifica
incrociata di ogni ANALISI_STATO.md esistente contro il codice reale. **Nessuno dei 9
moduli è ancora agganciato a EAOSv6** (zero occorrenze di erpv6.core.node/SAFE_PROCESSES/
process_key/circuit_role/phase_gate_type/cron_role) — classificazione concettuale, non
un aggancio reale già esistente.

## erpv6_product_pricing
Banale, puramente anagrafico: 2 campi (x_setup_fee, x_commission_percentage) su
product.template via _inherit (models/product_template.py:7-17). Nessun metodo, nessun
asse EAOSv6 applicabile. x_setup_fee non è letto da nessun modulo (dato pronto, non
consumato, non è un bug).

## erpv6_brand
Modello erpv6.brand.project (models/brand.py:5-33), workflow draft→candidates_generated→
selected→finalized. action_finalize() (righe 27-33) — Motore IPO puro. Nessun KB/Output/
Gate/Cron nel modulo: è un "guscio" esteso via _inherit da erpv6_color/marketing/library/
whitelabel. Access: solo group_system scrive. Nessun bug nuovo.

## erpv6_integrity
erpv6.integrity.check (models/integrity_check.py:9-44). check_integrity() (righe 19-35) —
Motore IPO, invocato da bottone UI e da cron giornaliero reale (data/cron_data.xml).
Controlla solo che 3 moduli risultino installati.
Bug trovato: import morti (hashlib, os, cryptography.*) mai usati in nessuna riga — dead
import coerente col fatto che la verifica firma manifest è solo un commento mai
implementato. Nessun modulo dipende da erpv6_integrity — foglia isolata.

## erpv6_consulting
erpv6.consulting.brand (code univoco) e erpv6.consulting.consultant. Solo
_onchange_brand_id (righe 20-24) — nessun Motore/KB/Output/Gate/Cron applicabile.
Duplicazione dato centrale (già nota all'architettura §5): erpv6.consulting.brand.code è
una delle due fonti "brand" scollegate vs erpv6.whitelabel.config.code — confermato nel
codice reale, non risolto.

## erpv6_core
Modulo fondante, dipendenza di ~24 moduli. erpv6.abstract.model: zero _inherit in tutto
il repo — codice morto confermato ancora oggi. erpv6.core.tracked: drift rispetto al
vecchio doc, ora adottato anche da erpv6_production (non solo erpv6_bandi) — doc esistente
obsoleto su questo punto. erpv6.frontend.error: campo blocking calcolato solo lato client
(error_reporter.js, mai dedotto server-side).

## erpv6_booking
erpv6.booking.token, wizard bulk, estensione res.partner con 4 campi x_pi_*.
Bug confermato ancora presente: booking_token.py riga 1 non importa UserError da
odoo.exceptions, ma è usato alle righe 55/58/64 (action_book/action_cancel) — NameError
raggiungibile anche dall'endpoint pubblico auth='none' di erpv6_api_gateway.
Duplicazione + campi morti: x_pi_hourly_rate/x_pi_consultant_brand su res.partner
duplicano erpv6.consulting.consultant/brand E non sono mai letti da nessun altro file.

## erpv6_blockchain
action_certify() (blockchain_record.py:45-60) — aggiornamento positivo rispetto al vecchio
doc: non simula più una transazione fittizia, marca onestamente status='non_disponibile'.
Bug ancora presente: GET /api/blockchain/verify/<tx_hash> referenzia record.timestamp e
record.verification_url — nessuno dei due campi esiste sul modello, errore garantito.
3 file di viste mai caricati dal manifest — nessun form/menu raggiungibile da UI.

## erpv6_setup_wizard
action_fetch_verticals()/action_install_verticale() — Motore ESTERNO sincrono (chiama API
del parent, poi button_immediate_install() reale).
Bug nuovo: il modulo non ha alcun security/ir.model.access.csv — il menu "Setup Iniziale
Child" punta a un modello senza righe di accesso, AccessError per qualunque utente non
superuser.

## erpv6_parent_client
fetch() (parent_client.py:51-135) — Motore ESTERNO con cache locale e fallback su cache
scaduta.
Bug confermato ancora presente: riga 1 non importa fields, usato a riga 101 →
NameError garantito, mai emerso perché fetch() non ha alcun chiamante in tutto il repo —
codice morto e isolato, nonostante si presenti come infrastruttura essenziale.

### Osservazioni trasversali gruppo A
Duplicazione "brand" confermata di persona nel codice (consulting.brand.code vs
whitelabel.config.code, §5 già aperto). Duplicazione nuova: res.partner.x_pi_* duplica
dati già centrali su erpv6.consulting.*, e per giunta mai consumata da nessuno.

---

# Gruppo B — erpv6_crypto, erpv6_package, erpv6_saas

## erpv6_crypto
erpv6.crypto.engine (encrypt/decrypt/rotate_keys, righe 50-156) — Motore IPO. rotate_keys()
su cron reale ogni 6 ore. Non registrato in SAFE_PROCESSES (modulo pre-esistente).
Bug critico confermato, raggiungibile da un utente normale: security/ir.model.access.csv
concede erpv6.crypto.key SOLO a group_system, ma encrypt()/decrypt() cercano/creano quelle
chiavi SENZA sudo() (crypto_engine.py:59,102-117; crypto_key.py:26-52). erpv6_kb permette
a group_user di creare una voce KB cifrata (kb_knowledge.py:127-134 chiama encrypt() in
create()) — quindi un utente interno qualsiasi che crea una KB cifrata riceve un
AccessError non gestito. Non ipotetico: è il percorso più comune del motore.
Dipendenza implicita non dichiarata: erpv6_bandi/models/bando_source.py:102 chiama
erpv6.crypto.engine senza dichiarare erpv6_crypto nei depends (funziona solo per catena
transitiva via erpv6_deep_source).

## erpv6_package
erpv6.package.module (sync automatico con product.product), erpv6.package.custom
(aggregazione), wizard action_generate() — Motore AIPO via omni_bridge.
Bug critico per confronto diretto di firme: action_generate() fa
json.loads(execute_ai_task(...)) ma execute_ai_task ritorna SEMPRE un dict Python, mai una
stringa JSON — TypeError non gestito ad ogni esecuzione (il blocco except cattura solo
JSONDecodeError). Il wizard inoltre non è esposto da nessuna vista/menu — irraggiungibile
anche se il bug fosse corretto.
Dipendenza implicita non dichiarata: omni_bridge usato ma non nei depends (funziona solo
transitivamente via erpv6_typst→erpv6_bandi→erpv6_deep_source).
Claim obsoleto nel doc esistente: affermava nessuna vista per erpv6.package.module —
falso ora, aggiunta il 23/08/2026.

## erpv6_saas
erpv6.saas.tenant, erpv6.vertical.catalog (albero prodotto/variante). _cron_sync_
subscription_status() — cron reale giornaliero, legge E scrive (disattiva api_key).
get_modules_for_verticale() — Motore IPO pulito (nessun default implicito, warning
esplicito se verticale non trovato).
Bug: verticale = fields.Char(unique=True) — unique=True non è un parametro standard di
Char in Odoo, ignorato silenziosamente, nessun vincolo SQL reale.
Permessi ampi: group_user ha CRUD pieno su entrambi i modelli (può disattivare/cancellare
tenant di altri).
Duplicazione forte (stesso pattern company_code/brand di erpv6_tracking): erpv6.saas.
tenant.verticale è un Char libero SCOLLEGATO da erpv6.vertical.catalog (nessun M2O, nessun
vincolo) — nello stesso modulo che impone già quel vincolo su erpv6.kb.category.verticale.
Segnalato per §5 architettura, non risolto.
Nota: erpv6_api_gateway/controllers/saas_vertical_api.py duplica le stesse route di
saas_api.py ma non è importato in __init__.py — codice morto già ombreggiato.

---

# erpv6_whitelabel e erpv6_bandi

Entrambi legacy, pre-AEOSv6: nessun Motore/KB/Output/Gate/Cron dichiarato via
erpv6.core.node.

## erpv6_whitelabel
erpv6.whitelabel.config (code univoco), estensione res.company. get_active_config() è il
punto di ingresso unico e coerente.
Bug: action_preview() ritorna res_model='erpv6.whitelabel.preview' — modello inesistente
in tutto il repo, bottone "Anteprima" rompe sempre.
Bug di sicurezza: POST /api/whitelabel/update è auth='user' + sudo() sul model — QUALUNQUE
utente loggato (anche group_user) può riscrivere colori/CSS/logo della company, mentre
l'accesso diretto al modello per group_user è correttamente sola lettura — il controller
bypassa quel vincolo.
Rischio collegato: custom_css iniettato senza escaping in una f-string CSS servita su ogni
pagina backend/frontend — canale di scrittura ampio (vedi bug sopra) verso un consumo
globale non sanificato.
Fallback asimmetrico: get_active_config() crea silenziosamente una config 'default' se
manca tutto, ma ritorna vuoto esplicito se manca solo code/domain — due filosofie diverse
nello stesso metodo.
Claim obsoleto nel doc esistente: dava per assodato un consumo reale delle API whitelabel
dal frontend Next.js — verificato con grep, oggi NON esiste nessuna chiamata reale
(solo un flag whitelabelEnabled: false) — il modulo è scollegato anche dal suo unico
consumatore dichiarato.
Duplicazione "brand" rafforzata: erpv6.consulting.brand.color default '#1a2744' è lo
STESSO identico hex di whitelabel_config.primary_color default — non solo il concetto è
duplicato, anche il valore di default, pixel per pixel.

## erpv6_bandi
erpv6.bando/.bando.match/.bando.application/.bando.source (workflow completo e
funzionante per application). action_scrape_now() — orchestrazione esterna via
erpv6.deep.source.engine + erpv6.crypto.engine.
Bug confermato: eligibility_score (cuore del "matching intelligente") non è mai scritto —
_compute_eligibility() è uno stub pass, non collegato a @api.depends, mai chiamato.
Bug NameError: action_notify_consultant() usa UserError senza importarlo.
Bug: consultant_id ha domain su is_consultant, campo INESISTENTE su res.partner in tutto
il repo (stesso bug identico trovato anche in erpv6_omni_bridge/models/omni_call_log.py —
cross-modulo, non isolato).
Template email morto: mail_template_scadenza_bando dichiarato ma mai referenziato da
nessun cron/send_mail.
Duplicazione REST con modelli di sicurezza DIVERSI per lo stesso dominio dati:
erpv6_bandi/controllers/bandi_api.py (auth='user', sessione Odoo) vs
erpv6_api_gateway/controllers/bandi_api.py (auth='none' + autenticazione custom) — nessun
commento su quale sia quella ufficiale.
api_key su erpv6.bando.source: mostrato password in UI ma salvato in chiaro nel DB.

---

# erpv6_validation e erpv6_kb

Entrambi GIA' parzialmente wrappati da erpv6_core_engine (circuito 6 Giudici,
validation_session_ext.py, kb_engine_process) — l'analisi si concentra su cosa resta
scoperto, non ripete cosa è già coperto.

## erpv6_validation
_run_round() — AIPO puro via omni_bridge, firma verificata coerente. Sesto Uomo è
phase_gate_type='ai' (non circuit_role, correzione già applicata e verificata). PID di
retry tecnico collegato a cron reale, ritenta solo fallimenti tecnici mai disaccordi di
contenuto.
Bug reale — bypass concreto non ipotetico: erpv6_api_gateway/controllers/validation_api.py
espone POST /api/v1/validation/sessions/<id>/start che chiama action_start_validation()
DIRETTAMENTE, saltando run_six_judges_for_kb() — quindi salta: il controllo "nodo senza KB
collegata" (un analista senza rombo partirebbe comunque col prompt di default, senza
errore), il collegamento max_rounds↔retry_loop.max_iterations, e la creazione del record
di tracciamento erpv6.core.circuit.run.
[CORRETTO 29/08/2026] Copertura wrapping: i due endpoint REST approve/reject restavano un
percorso parallelo non wrappato — non aggiornavano mai erpv6.core.circuit.run.status,
un'approvazione fatta fuori dal pannello del circuito restava incoerente col resto del
grafo. Fix: vedi `_sync_circuit_run_for_session()` in validation_api.py (bug #1 del gruppo
api_gateway parte 2 sopra) — approve/reject via questo endpoint ora sincronizzano
run.status quando la sessione è wrappata in una run reale, senza duplicare la logica di
decisione (chiama solo `run._sync_from_session()`, già esistente). Il bypass di
action_start_validation() (sopra) resta invece non corretto — bug diverso, non toccato.

## erpv6_kb
Scoperta reale non nel vecchio doc: un gate di approvazione COMPLETAMENTE NUOVO per i
prompt AI (prompt_approval_state/pending_content/pending_author_id, righe 96-226 di
kb_knowledge.py) — un non-admin che modifica un prompt non scrive subito, resta "pending"
fino ad approvazione di un admin. Funzionalità reale e recente, non menzionata prima.
KB_TYPE_SELECTION ora include 'colori' (aggiunto per il pilota erpv6_color) — ma SOLO
quello dei 6 mismatch segnalati nell'architettura: psicologia/metodi/regole/storytelling/
commerciale restano tutti irraggiungibili, confermato dal commento stesso nel codice.
Bug: erpv6.kb.engine/.normalizer/.request/.usage restano senza righe di sicurezza in
ir.model.access.csv — invariato dal vecchio doc.
Dead code confermato: erpv6.kb.normalizer.normalize() zero chiamanti in tutto il repo,
incluso erpv6_core_engine; erpv6.kb.usage mai scritto da nessun .create().
Buco nel nostro stesso wrapping: i default impliciti dentro _process_colors/_psychology/
_storytelling (kb_engine.py) restano vivi per chiunque bypassi process_key=
'kb_engine_process' e chiami erpv6.kb.engine.process() direttamente — la protezione
KB_ENGINE_REQUIRED_INPUTS funziona solo dentro il nostro Motore, non è nel modulo sorgente.

---

# Gruppo C — erpv6_deep_source, erpv6_marketing, erpv6_methodology

Metodo: lettura integrale, ANALISI_STATO.md (tutti datati 15/08) verificati riga per riga
contro il codice attuale — in tutti e 3 almeno un claim si è rivelato obsoleto.

## erpv6_deep_source
Motore IPO: `erpv6.deep.source.engine.search_and_extract()` (models/deep_source_engine.py:
147-235) — recupero via scraper HTTP esterno (`_call_scraper_service`, righe 60-106) o API
ufficiale, poi AIPO reale via `omni_bridge.execute_ai_task` (righe 199-221) per l'estrazione
strutturata, poi `_save_to_kb()` (righe 108-145, get-or-create su erpv6.kb). Non registrato
in SAFE_PROCESSES — motore legacy pre-EAOSv6, non ancora cablato.
Claim obsoleto del vecchio doc: "nessun modulo chiama search_and_extract" — falso oggi,
chiamato da `erpv6_bandi/models/bando_source.py:93` (action_scrape_now, punto di ingresso
corretto) e da `erpv6_production/models/interview_engine.py:390` (bypass DELIBERATO e
documentato in codice, confermato con Denis il 23/08, perché kb_category_id required non
ha senso per un termine di vocabolario).
Bug: permessi UI incoerenti — action_execute_now() scrive senza .sudo() ma
ir.model.access.csv dà solo perm_write=0 a group_user → AccessError per non-admin (stesso
pattern trovato in erpv6_marketing, vedi sotto). _save_to_kb su update guarda il vecchio
is_encrypted del record (bug di erpv6_kb/kb_knowledge.py:172-176) → possibile content in
chiaro con flag is_encrypted=True se il record esisteva già non cifrato. kb_type hardcoded
'document'; _fetch_google_trends/_fetch_amazon ancora stub NotImplementedError.

## erpv6_marketing
AIPO: action_generate_naming_candidates() e action_generate_logo_ai() (marketing.py,
logo_generator.py), entrambi via omni_bridge — corretto, mai chiamata diretta a provider.
IPO: action_generate_logo_draft() (SVG deterministico via hash MD5). Nessuno dei 3
registrato in SAFE_PROCESSES, azionabili solo da bottone UI.
Bypass confermato dallo stesso core_engine (core_node.py:274-282 cita erpv6_marketing come
bypass noto di register_document()) — ma register_document() non accetta nemmeno
brand_project_id nella sua firma, quindi il bypass è anche un difetto del punto di ingresso
canonico, non solo negligenza del chiamante.
Bug permessi UI: stesso pattern di erpv6_deep_source (create() senza .sudo(), perm_create=0
per group_user) — confermato ancora vero.
Bug: partner.company_type ('person'/'company') usato come "settore" nel prompt AI
(marketing.py:46) — non è un settore, degrada silenziosamente il naming generato. Stesso
identico bug copiato in erpv6_color/models/color.py:52 — pattern duplicato tra 2 moduli.

## erpv6_methodology
Il più rilevante per EAOSv6: contiene già 2 Motori IPO generici e riusabili, ma il vecchio
doc (15/08) li dichiarava inesistenti — claim obsoleto più importante dei 3 moduli.
- `erpv6.heinrich.indicator.log_signal(res_model, res_id, severity, description=None)` —
  get-or-create, incrementa contatore per severità, errore esplicito su severity invalida.
  Già usato realmente da core_node.py:635 (run_scheduled_rule), core_output.py:65 (segnale
  categoria libreria nuova) e 8+ volte da erpv6_kaizen.
- `erpv6.pareto.analysis.log_item(res_model, res_id, name, frequenza, impatto)` — upsert su
  backlog Pareto + ricalcolo. Usato da erpv6_kaizen (kaizen_detected_signal.py, rule_engine).
[CORRETTO 30/08/2026] Gap architetturale: nonostante siano de facto Motori IPO generici
nella forma esatta richiesta da SAFE_PROCESSES, nessuno dei due era registrato lì —
raggiungibili solo da codice Python hardcoded, non da un Nodo con process_key dichiarato a
schermo. Fix: registrati come `heinrich_log_signal` e `pareto_log_item` in
`erpv6_core_engine/models/core_node.py` (SAFE_PROCESSES), con validazione esplicita degli
input richiesti (nessun default implicito, `UserError` se manca qualcosa) — non
reimplementano nulla, avvolgono i due metodi reali già esistenti. Promosso con
`promote_module.sh erpv6_core_engine` (staging=produzione="erpv6" oggi, stesso DB) e
verificato dal vivo in odoo shell con dati fittizi: `heinrich_log_signal` crea/aggiorna
l'indicatore e incrementa il contatore giusto, `pareto_log_item` crea l'item con
`total_score` corretto, l'input mancante solleva `UserError` esplicito — record di test
cancellati subito dopo. Primo passo dei due concordati con Denis per iniziare davvero a
sostituire l'orchestrazione hardcoded con circuiti: ora qualunque circuito futuro può
riusare questi due Motori invece di reinventarli.
Bug/debito: matrix_type ancora hardcoded (Selection chiusa, ora 3 valori — 'tecnico'
aggiunto come CODICE per il caso Kaizen, non come dato KB — conferma che il problema
motore/conoscenza segnalato il 15/08 non è risolto, solo istanziato di nuovo).
Dipendenza implicita non dichiarata (bug reale, sul consumer non su questo modulo):
erpv6_agent/models/agent_communication.py:75-77 dichiara Many2one verso 3 modelli di
erpv6_methodology, ma erpv6_agent/__manifest__.py NON dichiara erpv6_methodology né diretta
né transitivamente — funziona solo perché in produzione viene sempre installato insieme a
erpv6_production/erpv6_kaizen/erpv6_core_engine. Installazione minimale romperebbe.

**Pattern trasversale**: bottone action senza `groups=` che scrive senza `.sudo()` su un
modello con perm_create/write=0 per group_user — presente identico in erpv6_deep_source E
erpv6_marketing. Da trattare come classe di bug unica, non 2 casi isolati.

---

# erpv6_api_gateway — parte 1 (main, frontend_error, kb, user, file, project, saas_vertical,
booking, library, ai, sign, interview, accounting)

Modulo di soli controller REST (models/ contiene solo api_key/api_log/webhook, infrastruttura
gateway). Bug reali trovati (file:riga):
1. `main.py:39` — `expires_at` di erpv6.api.key dichiarato ma mai controllato in
   _authenticate(): chiave scaduta ma non disattivata a mano resta valida per sempre.
2. `models/api_key.py:18-19` + `ai_api.py:40` — rate_limit_per_minute/day dichiarati ma MAI
   implementati; `_check_rate_limit()` chiamato ma non esiste in nessuna classe →
   `/api/v1/ai/chat` fallisce SEMPRE con AttributeError, non ha mai funzionato come scritto.
3. `partner_api.py:23-27,91-98,117-118` — campi ateco_code/fiscal_regime non esistono (reali:
   v6_ateco_code/v6_fiscal_regime su erpv6_accounting/models/res_partner.py), modello
   'ateco.at' non esiste (reale: erpv6.ateco.regime); il PUT risponde successo (echo dei dati
   inviati) senza aver scritto nulla — hasattr sempre False maschera il fallimento.
4. `file_api.py:57-82` — **IDOR**: download_file richiede solo auth generica, nessun controllo
   ownership/company/res_model — qualunque utente autenticato scarica qualunque allegato del
   sistema per ID sequenziale (fatture, KB, contratti di altri clienti inclusi).
5. `file_api.py:36-42` + `library_api.py:107` — bypass confermato di
   erpv6.library.document.register_document() (create() diretta), coerente col debito già
   noto in ARCHITETTURA_AEOSV6.md §6.4.
6. `kb_api.py:41`, `booking_api.py:90,111` — rotte POST/GET pubbliche senza 'OPTIONS' →
   preflight CORS bloccato lato browser se il frontend gira cross-origin (booking è più grave:
   sono le uniche 2 rotte pubbliche auth='none' per completare una prenotazione dal link).
7. `accounting_api.py:27-43` — **IDOR**: get_fiscal_prediction accetta partner_id da query
   string mai verificato contro l'utente autenticato; inoltre esegue action_calculate() (side
   effect di scrittura) dentro una GET.
8. `sign_api.py:103-148` — IDOR leggero: stato firma leggibile da qualunque utente autenticato
   con token valido, non solo dal firmatario/proprietario.
9. `saas_vertical_api.py` — intero file MORTO, non importato in controllers/__init__.py,
   shadowato dalla copia reale in erpv6_saas/controllers/saas_api.py.

Corretti/puliti: frontend_error_api, project_api (unico con ownership check corretto e
coerente), interview_api (pattern difensivo 'model' not in request.env, no hasattr).

Duplicazioni segnalate (non risolte): ownership check `project.partner_id ==
partner.commercial_partner_id` duplicato identico in project_api.py:55-58 e
library_api.py:27-30; calcolo consultant_id da partner_id duplicato in main.py:148-149 e
user_api.py:24-25 — nessun metodo centrale su res.users/res.partner.

---

# erpv6_api_gateway — parte 2 (bandi_api, methodology_api, validation_api, tracking_api,
consultant_api, lead_api)

Tutti e 6 puro proxy REST verso modelli pre-esistenti, nessuna classificazione EAOSv6
applicabile. Bug per priorità:

1. **[CORRETTO 29/08/2026] Grave — audit trail rotto**: `validation_api.py:209,247`
   chiamavano `session.action_human_approve()/action_human_reject()` su un record
   `.sudo().browse()` **senza `with_user(user)`** → dentro `validation_session.py:368-373`,
   `self.env.user` non era l'approvatore JWT risolto ma l'utente base della richiesta
   (`auth='none'`), spesso vuoto/pubblico. Il campo `human_reviewer_id` — che deve
   registrare CHI ha dato l'approvazione umana finale, esattamente il gate richiesto da
   CLAUDE.md per `is_ccp_related=True` — veniva scritto con l'identità sbagliata o vuota.
   **Fix applicato**: `session.with_user(user).action_human_approve()/action_human_reject()`
   (stesso pattern già corretto in `consultant_api.py`). In più, collegato al sistema
   nuovo invece di restare un patch isolato: aggiunto `_sync_circuit_run_for_session()`,
   che se `erpv6_core_engine` è installato e la sessione è wrappata in un
   `erpv6.core.circuit.run` (es. circuito 6 Giudici) sincronizza subito `run.status` dopo
   l'approvazione/rifiuto — chiude anche il gap "copertura wrapping" segnalato nella
   sezione `erpv6_validation` sopra. Verificato dal vivo con dati fittizi (sessione+run di test, cancellati
   subito dopo): confermato che `.sudo()` nudo lasciava `human_reviewer_id`=utente tecnico
   della richiesta, `with_user(user)` risolve correttamente il vero approvatore;
   confermato che `run.status` passa da `human_gate_pending` a `passed_gate` dopo
   l'approvazione via questo endpoint.
2. **IDOR** `bandi_api.py:71` (`get_bandi_match`) — partner_id da query senza ownership
   check, espone `eligibility_score`/`motivi_esclusione`/`importo_stimato` di clienti terzi
   (4a occorrenza dello stesso pattern già visto 3 volte in parte 1).
3. **IDOR incoerente** `methodology_api.py` — Pareto filtra per partner in lista
   (righe 29-53) ma NON in dettaglio (righe 88-137); Kairós/5S/Heinrich non filtrano mai, né
   in lista né in dettaglio, pur avendo lo stesso schema res_model/res_id disponibile.
4. **IDOR** `validation_api.py` — nessuno dei 5 endpoint verifica che la sessione appartenga
   al chiamante, incluse sessioni CCP-correlate.
5. **Nessuno scoping multi-company** `tracking_api.py` — liste/dettaglio lotti/config senza
   filtro company_id, rischio leak cross-company quando più aziende avranno company_code.
6. Duplicazione segnalata (non risolta): `lead_api.py` — `_assign_real_salesperson` (riga
   17-37) reimplementa un fallback già presente come logica primaria in
   `_promote_to_opportunity` (dichiarato in commento); soglie di scoring in `evaluate_lead`
   (righe 214-267) hardcoded nel controller, possibile motore di scoring centrale da
   confermare con l'utente.

Corretto: `consultant_api.py` — pattern con `with_user(user)` fatto bene, controprova per il
bug #1. `lead_api.py` auth='none' è per design (funnel pubblico), non un bug.

---

# Moduli ancora da analizzare (rilancio dopo reset rate limit, 18:40 Europe/Rome)

Tutti i gruppi completati.

---

# erpv6_production — parte 3 (consulente_assignment, crm_lead, kairos_scoring_rule,
kb_knowledge, prodotto_consulenza, production_event, production_phase, production_schedule,
res_users, resource_resource, typst_template, validation_session — overlap parziale con
parte 2 sui file più piccoli, contenuti diversi trovati)

Nessuna primitiva EAOSv6 in questo perimetro (zero occorrenze core.node/SAFE_PROCESSES) —
legacy pre-EAOSv6, classificato concettualmente.

**Bug — cascata FK incoerente, rischio reale su dati di produzione**: `product.product`→
`erpv6.prodotto.consulenza`→`erpv6.prodotto.consulenza.fase` tutto ondelete='cascade' (fix
25/08 per crash su ir.model.data), ma `erpv6.production.order.tranche.fase_config_id` è
ondelete='restrict' verso quella stessa fase. Se una produzione reale ha già generato
tranche su una fase di quel prodotto, cancellare il product.product fa fallire l'intera
cascata con IntegrityError — lo stesso problema che il fix cascade voleva risolvere, un
livello più giù, ora su dati di business reali.

**Bug — "round-robin" che sceglie sempre lo stesso consulente**: `crm_lead.py:352-368`
chiama l'assegnazione round-robin nativa Odoo con un recordset di UN SOLO lead (ensure_one
già garantito) — ma il round-robin nativo Odoo fa il giro solo dentro lo stesso batch
multi-lead della chiamata; chiamato lead-per-lead sceglie sempre `user_ids[0]`, mai un vero
giro tra i membri del team, contraddicendo il proprio commento e messaggio di attività.

**Bug — permessi incoerenti su dati sensibili (compensi/richieste assegnazione)**:
`ir.model.access.csv` dà read/write/create a `base.group_user` (praticamente ogni utente
interno) su `erpv6.production.consulente.line`/`.consulente.richiesta`, ma le uniche
`ir.rule` restrittive sono scoped solo a `erpv6_core.group_consulente` — un utente interno
che non è né consulente né sales manager/admin non ha NESSUNA regola che lo filtri: vede
(e per richiesta può scrivere) tutte le percentuali di compenso e richieste di
assegnazione/esclusione di TUTTI i consulenti, in contrasto con l'intento dichiarato nei
commenti stessi ("il Consulente vede solo le proprie").

**Bypass confermato (Etichettatrice+Traslo)**: `validation_session.py:262-266,290` genera un
certificato Typst e lo allega ai progetti bypassando interamente label_output/file_to_library
— nessuna categoria library dichiarata sull'output, stesso pattern già segnalato per altri
moduli, qui per un documento interno.

Bug noto confermato ancora presente: `typst_template.py:69-82` — required_fields salvato
come stringa JSON grezza in XML per tutti e 7 i template, tollerato con doppio json.loads
invece di corretto a monte.

**Duplicazione segnalata**: risoluzione supervisore KB reimplementata VERBATIM in due file
(`kb_knowledge.py:39-53` _resolve_kb_supervisor, il metodo "ufficiale", e
`typst_template.py:256-258` che rifà lo stesso env.ref invece di chiamare il metodo
ufficiale) — stessa fonte, stessa logica, due copie indipendenti da mantenere in sync a mano.

Buon esempio non-duplicazione confermato: `RESPONSABILE_GROUPS`
(consulente_assignment.py:18-27) riusato correttamente da prodotto_consulenza.py per lo
stesso gate umano su creazione/modifica prodotto e su action_marca_incassata.

---

# erpv6_production — parte 2 (production_order, production_phase, production_event,
production_schedule, resource_resource, res_users, kairos_scoring_rule, kb_knowledge)

Nessun docs/ANALISI_STATO.md esiste per questo modulo. Dati XML seed verificati COERENTI col
codice attuale (opposto di altri moduli): le 3 fasi di production_phase_data.xml
corrispondono esattamente ai campi letti da _evaluate_and_advance_one, e le answer_label di
kairos_scoring_rule_data.xml combaciano esattamente con le opzioni reali del frontend
intervista.

Conferma importante: `erpv6_core_engine/data/circuit_produzione_fasi_data.xml` dichiara già
un intero "Circuito Produzione a Fasi" che rispecchia production_order, con Gate umano
"procedi/pianifica/fermati" già wrappato reale — MA nessuno dei nodi ha process_key
valorizzato (solo engine_model/engine_method documentari) → il circuito NON è eseguibile via
"Esegui Circuito" oggi, resta solo una mappa di lettura, non un motore vero collegato.

**Bug — notifica documento generato non scatta mai più (regressione)**: `document_generated`
calcolato in _evaluate_and_advance_one (riga 509-516) ma l'unico chiamante reale
(_do_advance_after_gate:1032) non lo passa mai a _notify_consultant_update — regressione
introdotta dal gate umano procedi/pianifica/fermati (23/08): generazione documento e
notifica/avanzamento ora avvengono in due invocazioni separate (cron vs conferma umana), il
dato non sopravvive tra le due. Il comportamento documentato nel docstring non si verifica
mai oggi.

**Bug — `omni_call_log_id` mai scritto** nemmeno dall'unico caso che dovrebbe farlo
(_run_metodo_ai chiama execute_ai_task e crea un production.event subito dopo, ma senza
passare omni_call_log_id) — campo morto rispetto al proprio scopo dichiarato.

Bug minori: `resource_resource.get_workload(date_from,date_to)` codice morto (zero
chiamanti, solo get_open_workload usato davvero); filtro _cron_evaluate_all potenzialmente
impreciso per ordini "a prodotto" (usa sequence del catalogo globale invece che della fase
prodotto specifica) — innocuo ma spreco di cicli non individuato prima.

Doppio percorso di attivazione da tenere d'occhio (non un bug): _cron_evaluate_all (ir.cron
legacy sempre active=True) e il trigger SAFE_ACTIVATION_TRIGGERS production_evaluate_advance
(PID, creato active=False) puntano allo stesso metodo idempotente evaluate_and_advance.

**Duplicazione segnalata**: `production_order.verticale` (Char libero) confrontato per
UGUAGLIANZA DI STRINGA ESATTA contro i codici di erpv6.vertical.catalog (modello reale con
gerarchia, già usato da res_users.competenza_verticale_ids come M2m vero) in
crm_lead._find_eligible_consulenti — nessun vincolo che garantisca che verticale contenga
davvero un codice valido del catalogo. Stessa classe di rischio già documentata in
ARCHITETTURA_AEOSV6.md §3.3.1 per library_category: un typo produce zero consulenti
eleggibili senza nessun errore esplicito. Da confermare con l'utente se centralizzare
(Many2one o constrains), non deciso qui.

---

# erpv6_agent — parte 2 (agent_pattern, agent_confirmation extra, agent_create_wizard,
agent_monitor, agent_proposal, agent_proposal_accept_wizard, agent_telegram_config,
kb_knowledge, library_document, agent_neo4j_client, agent_chat_log)

Nessun file usa erpv6_core_engine — modulo intero fuori dal layer EAOSv6, debito futuro.
Gate umano riusabile: erpv6.agent.confirmation (request_phase_decision) ed erpv6.agent.
proposal — entrambi mai auto-applicati, coerenti con CLAUDE.md.

**Bug — `answer_conversationally` rompe il proprio contratto**: quando `_try_direct_data_
answer` scatta (solo Susanba, keyword dati diretti), la funzione ritorna una stringa nuda
invece della tupla (messaggio, pending_action) attesa da OGNI chiamante (agent_confirmation.
py:216-217, agent_telegram_config.py:526-530) → `ValueError` non gestito (o peggio,
corruzione silenziosa se la stringa fosse lunga esattamente 2 caratteri). Riproducibile
scrivendo a Susanna una DIRECT_DATA_KEYWORD in un thread di conferma o su Telegram.

**Bug — cron senza isolamento errori**: `_cron_check_pending_confirmations` (agent_
confirmation.py:427-436) scandisce TUTTE le conferme pending senza try/except per record, a
differenza di `_cron_check_escalations` nello stesso file e di agent_monitor._cron_run_all —
un'eccezione su una sola conferma (es. il bug sopra) blocca l'intero giro per quel batch.

**Bug — flag morto**: `requires_context_category` (agent_pattern.py:26-30) dichiarato e
documentato ma mai letto da nessun codice — si può creare da Thor un agente text_proposal
senza categoria di contesto, contraddicendo la semantica dichiarata.

**Debito — nessuna whitelist su action_method**: stesso pattern già segnalato in parte 1,
qui su agent_confirmation.py:78-80/265/324 — nessun exploit attivo oggi (solo server-side,
readonly in vista) ma zero barriera tecnica futura.

**Bug — controllo proprietà incoerente**: `_handle_registra` (agent_telegram_config.py:
658-707) non verifica che l'entry corrisponda al canale/agente del click, a differenza di
`_handle_proposal_decision`/`_handle_confirmation_decision` nello stesso file che fanno
esplicitamente questo controllo — incoerenza di permessi.

Minore: `erpv6.agent.chat.log` ha ACL ma zero view/menu in tutto il modulo, nonostante sia
il modello che realizza la richiesta esplicita "le chat vanno salvate per imparare errori".

Duplicazione segnalata: `library_document.py:38-44` crea un crm.lead dedicato per OGNI
documento categoria agent_knowledge senza project_id (rischio frammentazione CRM), mentre
`agent_monitor.py:130-134` nello stesso modulo usa invece un lead canonico condiviso
(crm_lead_kb_admin) per lo stesso bisogno concettuale — due pattern diversi, da unificare.
`agent_neo4j_client.py` resta gemello duplicato (deliberato, per evitare ciclo dipendenze)
di erpv6_kaizen.neo4j_client — già noto, confermato ancora vero.

---

# erpv6_typst + pipeline documenti

`docs/ANALISI_STATO.md` (15/08) quasi interamente obsoleto — 4 claim smentiti: le due classi
omonime erpv6.typst.document sono già riconciliate; action_render() compila davvero via
subprocess typst (non più simulazione); erpv6.typst.engine.generate_document() è chiamato
realmente da production_order.py:323 e validation_session.py:263 (certificato 6 Giudici);
il sorgente .typ NON è in erpv6_kb, per scelta di design deliberata (codice layout, non
conoscenza), non per un bug. check_typst_installed() resta invece confermato codice morto.

**[CORRETTO 30/08/2026] Bug/debito principale — il Motore IPO `generate_phase_document`
esiste ed è cablato alla pipeline reale, ma non era MAI istanziato su un nodo con
process_key** in nessun data XML — il "Circuito Produzione a Fasi" era solo rappresentativo
(engine_model/engine_method documentativi), non eseguiva mai run_process() per Typst.
Fix: `process_key='generate_phase_document'` aggiunto ai nodi `node_fase_relazione` e
`node_fase_consegnato` (`circuit_produzione_fasi_data.xml`) — record già esistenti sotto
`noupdate="1"`, quindi sincronizzati anche via scrittura diretta (con commit esplicito) dopo
il promote, non solo dichiarati nell'XML. Verificato dal vivo col materiale di test già nel
seed (`production_order_test_material`): `node_fase_relazione.run_process()` genera
DAVVERO un documento reale via la pipeline Typst (fase con typst_template_id configurato,
PROP-L2-001) — la prova che il grafo ora guida l'esecuzione reale, non solo la documenta.
`node_fase_consegnato.run_process()` risponde onestamente `success=False`: quella fase NON
ha ancora un typst_template_id configurato — gap reale e pre-esistente del catalogo
template (non un bug del wiring, `_generate_phase_output` lo segnala già esplicitamente,
mai un fallback inventato), da colmare separatamente configurando il template mancante.
Artefatti di test (documento, execution) creati e cancellati esplicitamente, mai la
configurazione dei nodi. **Aggiornamento 30/08/2026**: dichiarati anche i due
`erpv6.core.output` (`output_fase_relazione`/`output_fase_consegnato`, categoria risolta
automaticamente) — soddisfa la regola fondamentale (§3.3, ogni circuito deve dire che
output genera) SENZA aggiungere Etichettatrice/Traslo: `_generate_phase_output` chiama già
`register_document()` (punto di ingresso canonico corretto, non un bypass), quindi
incatenare Traslo dopo avrebbe archiviato lo stesso documento due volte. `erpv6.core.output`
è puramente dichiarativo (`resolve_value()` legge l'ultima esecuzione riuscita del nodo, non
archivia nulla lui stesso) — verificato dal vivo che rispecchia davvero l'esecuzione reale.
Durante la verifica trovato e ripulito un documento di test orfano rimasto da una sessione
precedente (source lead già cancellato) — non creato in questo giro, solo scoperto e pulito.
Conseguenza diretta ancora aperta, non toccata in questo giro: i Motori
generici Etichettatrice+Traslo (label_output/file_to_library, pensati apposta per unificare
l'archiviazione) NON sono usati dalla pipeline Typst→Libreria reale —
production_order.py:363-371 chiama register_document() direttamente, bypassando i nuovi
Motori generici — lo stesso pattern di bypass che core_node.py segnala per altri moduli,
qui riprodotto da un chiamante legittimo del sistema stesso.

**Pipeline typst→library(+blockchain) confermata collegata davvero** (non solo dichiarata):
register_document(is_final=...) → action_certify_blockchain() solo se is_final → crea un
erpv6.blockchain.record reale. Ma il criterio "esterno" è ristretto a
output_category=='final': documenti NDA/proposta/contratto/SAL/business_plan inviati
davvero a un cliente (via action_send_to_partner) NON vengono certificati se non sono
'final'. Confronto rivelatore: _run_metodo_ai nello stesso modulo usa un criterio diverso e
più granulare (is_final_client_facing esplicito per categoria) — due logiche scollegate per
decidere lo stesso concetto di business "è client-facing?", solo segnalato.

Bug minori: typst_path configurabile ma mai letto (hardcoded 'typst' in
_generate_pdf_with_typst); nessuna riga ir.model.access.csv per erpv6.typst.engine
(innocuo, nessuna vista lo espone).

`erpv6.package.module`↔`erpv6_typst`: collegamento CONFERMATO FATTO (non più "da fare"),
vive in erpv6_production (typst_template.py estende via _inherit, _resolve_required_fields
fa fallback dal template al package.module) — coerente con "intervista dinamica da
template" già noto. Sorgente .typ resta stub vuoto intenzionale (motore di generazione
codice non ancora progettato).

**Triplicazione segnalata**: 3 Selection chiuse indipendenti per "che tipo di documento è"
(erpv6.typst.template.category 9 valori, erpv6.library.document.category 13 valori,
erpv6.production.phase.output_category 8 valori), valori disallineati tra loro, nessuna
delega al nuovo catalogo centrale erpv6.core.library_category costruito apposta per questo
— istanza concreta del pattern §5 dell'architettura.

---

# erpv6_omni_bridge — relè AIPO

Il relè AIPO stesso (`erpv6.omni.bridge.execute_ai_task`, non un Nodo SAFE_PROCESSES). Il vero
Motore AIPO registrato è `ai_analyze`→`_run_ai_analyze` (core_node.py:58-100), che passa
correttamente dal relè (riga 90). Verificato con grep incrociato su tutto il repo: NESSUN
bypass con SDK esterno diretto trovato (nessun import openai/groq/cerebras fuori da qui) —
tutte le requests.post dirette in altri moduli sono Motori ESTERNO legittimi (Documenso,
Telegram, scraper interno) o download di risultato già ottenuto dal bridge.

**Claim obsoleto in ANALISI_STATO.md (15/08)**: dichiarava `get_next_provider()`/
`routing_strategy` "codice morto/inefficace" — falso oggi, fixato il 21/08/2026
(omni_bridge.py:79-93, commento esplicito "agente di verifica dedicato").

**Bug/debito grave 1 — endpoint HTTP duplicato con drift reale**: `controllers/
controllers.py:82-234` (`/api/v6/omni/execute`, si autodefinisce "ENDPOINT PRINCIPALE")
reimplementa da zero il routing invece di chiamare execute_ai_task — non applica
get_next_provider() (righe 118, lista provider statica) né il fix "model per-provider" del
21/08. Nessuna chiamata reale trovata da apps/ verso questo endpoint (il percorso frontend
reale è erpv6_api_gateway/ai_api.py→execute_ai_task) — sembra codice legacy non allineato,
ma resta live ed esposto (auth='user').

**Bug/debito grave 2 — wiring provider del 6 Giudici assente da git**: le route XML per
validation_analyst/validation_sesto_uomo, kaizen_agent_propose, agent_knowledge_extraction,
logo_generation_ai dichiarano solo routing_strategy, MAI primary_provider_id/
fallback_provider_ids — i provider reali sono "configurati a mano sul DB del VPS, non
tracciati in XML" (commento nel codice stesso). Il circuito che CLAUDE.md rende non
negoziabile per le proposte CCP/fiscali dipende quindi da un wiring che non esiste in nessun
file versionato: se il DB del VPS si perde, il modulo si installa ma il 6 Giudici non ha
alcun provider finché qualcuno non lo riconfigura a mano, in silenzio. Causa strutturale
della nota già in memoria (162 sessioni escalated, Cerebras→Groq fallback).

Bug minori: `get_decrypted_api_key()` non ha gate di accesso proprio oltre l'ACL sul modello
(convenzione "mai esporre al frontend", non enforcement); fallback silenzioso non bloccante
per chiavi legacy in chiaro (solo warning, già noto, ancora vero); `get_optimal_model()`
legge sempre il primo elemento di una lista libera per virgole, ignora task_type/context
nonostante il nome — illusione di configurazione mai chiusa (segnalato, non risolto).

---

# erpv6_accounting

Nessuna integrazione EAOSv6 (manifest non dipende da erpv6_core_engine, zero riferimenti
core.node/SAFE_PROCESSES) — classificazione concettuale. Modello `erpv6.ateco.regime`
confermato (non 'ateco.at').

**Bug — `ateco.at` non esiste**: `erpv6_api_gateway/controllers/partner_api.py:92` cerca il
modello `ateco.at`, che non esiste in nessun modulo — reale è `erpv6.ateco.regime` (definito
qui, usato correttamente da `erpv6_tracking/tracking_config.py:66,108`). KeyError a runtime
se mai raggiunta (bug distinto da quello hasattr già noto sullo stesso file).

**Bug — cron pronto a esplodere**: `data/cron_jobs.xml:9` chiama
`search([('state','=','draft')]).action_calculate()` su un metodo che inizia con
`self.ensure_one()` (`fiscal_prediction.py:149`) — con più di una previsione draft (stato di
default) il cron solleva eccezione. Non ancora emerso solo perché disattivato di default.

**Bug — dipendenza implicita non dichiarata**: `account_move.py:35-37` collega
`crm.lead`, ma `crm` non è nei depends né arriva transitivamente da `erpv6_core` (solo
base+mail) — funziona solo perché crm è installato altrove nel sistema per altri motivi.

**Bug — permessi incoerenti tra due controller per la stessa operazione**: il controller
interno `erpv6_accounting/controllers/accounting_api.py` chiama senza `.sudo()` (AccessError
per un utente con solo ruolo fatturazione, non manager, su create), mentre
`erpv6_api_gateway/controllers/accounting_api.py` fa tutto con `.sudo()` (bypassa
silenziosamente lo stesso controllo) — due comportamenti di sicurezza diversi per la stessa
identica operazione logica.

`erpv6_core` dichiarato nel manifest ma mai usato (dead dependency). Aliquote fiscali
hardcoded in Python, mai risolte via erpv6_kb nonostante il manifest dichiari
"integrazione con erpv6_kb per regole fiscali cifrate" — erpv6_kb non è nemmeno nei depends.

**Triplicazione Kairós (più grave del previsto)**: `erpv6.fiscal.prediction` (righe 87-145)
reimplementa quasi identica la stessa struttura di `erpv6.kairos.matrix
matrix_type='finanziario'` (5 indicatori 1-3, stesse soglie 5-8/9-12/13-15) — il motore
generico esiste già proprio per questo caso (help text lo dice letteralmente), ma non è
usato. `res.partner` (righe 81-103) usa una TERZA formula ancora diversa (base 10 + bonus su
margine/fatturato). Tre implementazioni Kairós divergenti nel sistema, non risolto, da
decidere con l'utente dove deve vivere davvero questo calcolo.

---

# erpv6_agent — parte 1 (agent_config.py, agent_communication.py, agent_confirmation.py)

Modulo autonomo, NON usa erpv6_core_engine (zero riferimenti core.node/SAFE_PROCESSES) —
classificazione concettuale, non aggancio reale. AIPO sempre via omni_bridge.execute_ai_task
(nessun bypass trovato in questi 3 file). erpv6.agent.confirmation = Gate umano nel senso
EAOSv6 (pattern a 3 esiti procedi/pianifica/fermati, vocabolario chiuso, mai libero) — oggi
collegato solo da erpv6_production/production_order.py:668.

**Bug reale (silent fallback) — `notify_partner_ids` per-agente ignorato dopo il primo
avviso**: `_default_notify_partner_ids()` (agent_config.py:158-172) legge correttamente
`self.notify_partner_ids` quando chiamato su `self`=agente specifico (funziona in
notify_pending_confirmation). Ma in agent_confirmation.py TUTTE le chiamate successive nello
stesso thread lo invocano su un recordset vuoto invece che sull'agente coinvolto:
`_reply_conversationally:232-235`, `_do_confirm:290-293`, `_do_phase_decision:350-352`,
`_escalate:502,524-527` (qui ancora più grave: l'escalation è di Susanna ma usa
`AgentConfig` vuoto invece di `susanna._default_notify_partner_ids()`). Essendo il check
`if self and self.notify_partner_ids` falsy su recordset vuoto, ricade SEMPRE su
admin/Denis — se un futuro agente (es. "Anna commercialista") avesse notify_partner_ids
verso il contabile, solo il primo avviso arriverebbe corretto, ogni risposta/ack/escalation
successiva tornerebbe silenziosamente a Denis.

Debito segnalato (non un bug attivo oggi): `action_method` su erpv6.agent.confirmation è un
Char libero eseguito via getattr() senza whitelist tipo SAFE_ACTIVATION_TRIGGERS — non
sfruttabile oggi (readonly in vista, solo group_system scrive, unico chiamante verificato è
production_order.py:668), ma da chiudere se action_method diventasse configurabile da UI/AI.

Nessun dato duplicato in senso stretto (fonti già centrali: pareto/kairos/heinrich sempre
collegamenti diretti, mai testo libero copiato) — solo osservazione di manutenibilità:
persona_text+instructions_text ricostruiti identici in 4 metodi diversi invece di un unico
_build_persona_and_instructions() condiviso.

---

# erpv6_production — parte 1 (consulente_assignment, crm_lead, interview_engine,
kairos_scoring_rule, kb_knowledge; escl. kb_validation_gate.py)

Nessuna integrazione EAOSv6 in questi 5 file (zero occorrenze core.node/SAFE_PROCESSES/
process_key) — logica di business non ancora decomposta, classificazione 5 assi non
applicabile in senso stretto, segnalato invece di forzata.

**Bug reale — `_start_production` sovrascrive ordini invece di crearne di nuovi**
(`crm_lead.py:238` + `interview_engine.py:212-214`): `search([('lead_id','=',self.id)],
limit=1)` senza filtro verticale/prodotto, ma `erpv6.interview.session` dichiara
esplicitamente (docstring) che un lead può avere PIÙ sessioni (seconda intervista per un
secondo prodotto) e `erpv6.production.order` non ha `_sql_constraints` su lead_id che lo
impedisca. Risultato: la seconda intervista completata trova con limit=1 l'ordine del PRIMO
prodotto e ci scrive sopra interview_score/verticale/budget del secondo — sovrascrittura
silenziosa, nessun errore/log. Contraddice il proprio modello sorella. Da confermare con
l'utente prima di correggere (nessuna modifica fatta).

Bug minore: `consulente_assignment.py:98-101` — vincolo unique(lead_id,user_id,role) non
blocca referral duplicati (role='referral' impone user_id=NULL, Postgres non collide su
NULL in UNIQUE) → stesso segnalatore esterno aggiungibile più volte sullo stesso lead.

Corretti/puliti, nessun bug: `kairos_scoring_rule.py` (buon esempio citato nel proprio
commento di applicazione del principio motore/conoscenza — regole spostate da dizionari
Python a modello dati admin-modificabile, get_score() ritorna None esplicito se non
riconosciuto); `kb_knowledge.py` (_resolve_kb_supervisor, action_validate_selected — nessun
fallback silenzioso); doppio gate umano in consulente_assignment.py (write() override blocca
anche scritture ORM dirette, non solo bottoni UI — difesa in profondità corretta).

Segnalazione orchestratore (non risolta): `erpv6.vocabulary.entry` (termine "altro"
nell'intervista, promozione a erpv6.vertical.catalog) è un meccanismo di conoscenza
parallelo al rombo KB del core engine — verificare se un futuro Motore "termini candidati"
dovrebbe collegarsi qui invece di inventare una tabella nuova.

