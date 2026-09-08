# Circuito Win-Win — Parte Web (attesa asincrona + pagina report)

Continua da `CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE.md` e `CIRCUITO_WINWIN_RENDERDATA_ROADMAP_RACCOMANDAZIONE.md` (Motore/Gate/Roadmap/Raccomandazione già completi e verificati). Branch: `feature/circuito-winwin-renderdata` (locale, nessun commit, nessun push).

**Stato: tutte le 5 fasi completate e verificate dal vivo, incluso un vero test end-to-end automatico (interviste reale → cron reale, senza nessun intervento manuale nel mezzo → email reale inviata).**

---

## Fase 0 — Verifica (sola lettura)

1. **`BlurLock.tsx`**: confermato codice morto — `grep` di "BlurLock" in tutto `apps/impresa/src` trova solo il file stesso, nessun import altrove.
2. **Pattern "esegui appena possibile"**: nessun cron dinamico creato-al-volo già in uso; trovato invece `_cron_retry_escalated_ai_failures` in `erpv6_validation` come precedente di "cron periodico che pesca record in uno stato specifico" — stesso principio riusato qui (cron ogni 1 minuto, non un cron per singolo caso). Trovato anche `erpv6.core.node.create_cron_node()`/`wrap_existing_cron_node()` in `erpv6_core_engine`, con un commento esplicito sul principio "non duplicare cron reali" — non pertinente a un cron nuovo come questo, ma confermato coerente con l'approccio scelto.
3. **Meccanismo di notifica riusabile**: trovato `erpv6.agent.communication.create_and_route()` (già usato da `erpv6_kaizen` per notificare Denis su un'anomalia rilevata) — riusato tale e quale per la rete di sicurezza a 30 minuti, invece di inventare un canale nuovo.
4. **Endpoint di completamento intervista**: `erpv6_api_gateway/controllers/interview_api.py`, metodo `answer_interview()`, riga ~163 (`completed = session.state == 'completed'`) — punto di aggancio esatto per generare il token.

## Fase 1 — Backend: token + cron

**Nuovo modello `erpv6.winwin.report.token`** (`odoo-modules/erpv6_winwin_renderdata/models/report_token.py`): `token` (non enumerabile, `secrets.token_urlsafe(32)`), `production_order_id`, `scadenza` (30gg), `stato` (`in_elaborazione`/`pronto`/`inviato_email`, esattamente i 3 valori richiesti) + campi interni di gestione coda (`started_at` per il lock, `errore`, `escalation_notificata`).

**Generazione immediata**: `interview_api.py` aggiornato (duck-typing, `erpv6_api_gateway` resta agnostico da `erpv6_winwin_renderdata`, stesso pattern già usato per `_start_production`) — quando `completed=True`, crea il token e lo aggiunge alla risposta JSON come `winwin_report_token`, **prima** che qualunque elaborazione pesante parta.

**Cron "esegui appena possibile"**: `_cron_process_pending_tokens()`, ogni 1 minuto, reclama fino a 5 token con `FOR UPDATE SKIP LOCKED` (sicurezza su esecuzioni sovrapposte), committa il lock subito (non tiene la riga bloccata per i minuti che il Gate 3B può richiedere), poi per ciascuno chiama `build_and_validate_render_data()` + `generate_winwin_documents()` (già esistenti, invariati) e porta `stato='pronto'`.

**Endpoint di stato leggero**: nuovo controller `erpv6_api_gateway/controllers/winwin_report_api.py` — `GET /api/v1/winwin-report/status?token=...` → `{stato, report_url}`, un solo lookup, nessun lavoro pesante (verificato leggendo il codice: nessuna chiamata a Motore/Gate). Un secondo endpoint, `GET /api/v1/winwin-report/data`, ritorna il render_data completo (sempre `preview:true`) per la pagina report — anch'esso un lookup puro sul campo già salvato.

**Bug reale trovato e corretto durante il test dal vivo**: `erpv6.agent.communication.route()` → `_route_via_susanna()` richiede che il record collegato (`res_model`/`res_id`) supporti `message_notify()` (da `mail.thread`) — il modello token non lo ereditava, causando un `AttributeError` reale al primo test dell'escalation. Corretto aggiungendo `_inherit = ['mail.thread']`.

**Verificato dal vivo**:
- `docker exec` diretto: creazione token, cron eseguito manualmente in modo bloccante (non a cicli, seguendo l'indicazione esplicita di evitare i loop improduttivi dei giri precedenti) → `stato='pronto'`, poi corretto un bug reale (`'crm.lead' object has no attribute 'email'`, doveva essere solo `email_from`) e un secondo bug reale (mittente email finiva `odoobot@example.com` invece di `noreply@v6impresa.it` se non specificato esplicitamente — corretto forzando `email_from` dal parametro `mail.default.from`).
- Endpoint `/api/v1/winwin-report/status` e `/data`: testati con `curl` reale contro `https://erp.v6sviluppoimpresa.it`, risposte corrette (incluso il caso "token inesistente" → 404 pulito).

## Fase 2 — Email su completamento reale

`_send_ready_email()` viene chiamata dentro `_process_one()` **subito dopo** che `stato` passa a `'pronto'`, mai su un timer fisso — verificato: nel test end-to-end reale sotto, il tempo reale tra creazione del token e invio email è stato di circa 90 secondi (non un intervallo fisso configurato altrove).

**Mittente**: `noreply@v6impresa.it` (letto da `mail.default.from`, forzato esplicitamente) — **deliberatamente diverso** dal server register.it/`v6sviluppoimpresa.it` usato altrove in questa sessione per il Progetto TEE: sono due identità di invio per due business distinti, mai mescolate.

**Rete di sicurezza a 30 minuti**: `_check_stale_escalation()`, verificata dal vivo con un token sintetico con `started_at` forzato a 45 minuti fa → `erpv6.agent.communication` creata correttamente (id 19), instradata via Susanna (`routing_state='sent_via_susanna'`, `heinrich_severity='lieve'`), `escalation_notificata=True` per evitare notifiche ripetute. Non è il meccanismo primario (mai osservato scattare nei test di completamento reale, che convergono in 1-2 minuti), ma è verificato funzionante.

## Fase 3 — Frontend: attesa singola, non polling continuo

**Scoperta rilevante in Fase 0/durante l'implementazione**: l'infrastruttura di attesa (rotazione micro-copy, nessuna barra/percentuale) **esisteva già** in `InterviewTreeFlow.tsx` (`WAIT_MESSAGES`, `WAIT_TIMEOUT_MS`, `WAIT_ROTATE_MS`), costruita da un task precedente (commento nel codice: "TASK-3") che aveva esplicitamente lasciato "il report completo... fuori scope". Non ho ricostruito nulla da zero: ho **collegato** quell'infrastruttura già pronta al circuito reale invece di duplicarla.

Modifiche: `WAIT_TIMEOUT_MS` portato da 18000 a **30000** (costante unica, come richiesto, nessun valore sparso altrove); alla scadenza parte **una sola** chiamata a `checkWinwinReportStatus(token)` (nuovo `lib/winwin/report-client.ts`) — se `pronto`, `router.push('/report/[token]')`; se `in_elaborazione`, resta il messaggio statico già scritto in precedenza ("ti mandiamo il risultato completo via email... puoi chiudere questa pagina tranquillamente") — non ho dovuto riscriverlo, era già il messaggio corretto, semplicemente non era ancora collegato a un controllo reale.

Il token arriva dalla risposta di `answerInterview()` (tipo `AnswerInterviewResult.winwin_report_token`, nuovo campo) e viene passato tale e quale dal proxy Next.js esistente (`/api/interview-tree/answer/route.ts`, verificato che fa già un passthrough verbatim di `result.data`, nessuna modifica necessaria lì).

## Fase 4 — Pagina report (`/report/[token]`)

Nuova pagina (`apps/impresa/src/app/report/[token]/page.tsx`), client component, fetch via `/api/winwin-report/data`:
- **Sempre visibile per intero**: intestazione (azienda/tipo progetto/data), quadrante Kairós (impatto/prontezza), diagnosi (metriche con colore verde/ambra/rosso), criticità, azioni urgenti.
- **Dietro `BlurLock.tsx`** (riusato tale e quale, non ricostruito — rispetta già il principio "mai su criticità/azioni_urgenti" nel suo stesso commento): sintesi, azioni win-win (schede), roadmap, raccomandazione. Prima riga della prima opportunità sempre leggibile per intero, come richiesto dal componente stesso.
- **Upsell secondario**: box separato (bordo navy `#0F1E3C`, mai nello stesso riquadro di BlurLock), mostrato **solo se** 2+ elementi in stato rosso tra metriche/criticità (`contaRossi()`, condizione deterministica sui dati reali, non un box statico uguale per tutti) — nessuna urgenza artificiale, nessun countdown.
- Palette del sito riusata (`#0F1E3C` navy, `#D4703A` terracotta, `#F7F3ED`/`#F8F6F2` crema — stessi valori esatti già usati in `BlurLock.tsx`, non inventati).

**Nuovi file**: `lib/winwin/report-client.ts` (client fetch + tipi), `app/api/winwin-report/status/route.ts` e `app/api/winwin-report/data/route.ts` (proxy verso Odoo, stesso pattern di `/api/interview-tree/*`).

**Bug reale trovato e corretto**: `middleware.ts` blocca di default tutte le route senza cookie di sessione (redirect a `/login` per le pagine, 401 JSON per le API) — le nuove route `/report` e `/api/winwin-report` **non erano nell'allowlist** `PUBLIC_PATHS`, quindi la pagina report (raggiunta da un cliente anonimo via link email) sarebbe stata bloccata. Corretto aggiungendo entrambe all'allowlist.

**Nota onesta sul pagamento**: `BlurLock.onUnlock` oggi sblocca solo lo stato locale della pagina (mostra il contenuto pieno), non è collegato a nessun pagamento reale né al mock esistente (`/checkout/[id]`, che si aspetta un `invoice` con un ID diverso dal token) — collegarlo per davvero è lavoro separato, esplicitamente fuori scope ("resta mock per questo giro" nel prompt).

## Fase 5 — Verifica end-to-end

**Ambiente di test**: dipendenze mai installate in precedenza in questo ambiente (`node_modules` assente) — installate con `npm install -w apps/impresa` (807 pacchetti, ~30s), poi **dev server Next.js locale** (porta 3300) puntato al backend Odoo reale via `.env.local` già configurato (`ODOO_URL=https://erp.v6sviluppoimpresa.it`, chiave API reale) — non un deploy Vercel, come previsto dal contesto ambientale per questo giro.

**Verificato dal vivo, in ordine**:
1. `tsc --noEmit` su tutto `apps/impresa`: **0 errori** (compilazione TypeScript pulita su tutti i file nuovi/modificati).
2. Endpoint proxy (`/api/winwin-report/status`, `/data`) e pagina `/report/[token]` testati via `curl` reale contro il dev server locale: HTTP 200, dati reali, nessun errore nel log del server.
3. **Test end-to-end completamente automatico, senza intervento manuale nel mezzo**: creata una intervista reale nuova, risposta finale mandata con una **vera richiesta HTTP POST** a `/api/v1/interview/answer` (non ORM diretto) → risposta conteneva `winwin_report_token` reale. Atteso **passivamente** (nessuna chiamata manuale al cron): il cron periodico reale (già registrato, gira ogni minuto) ha reclamato il token e completato l'intera pipeline (Motore→Gate 3A→Gate 3B con chiamate AI vere→2 PDF→email) in **circa 90 secondi**, senza errori. Email verificata: `mail.mail` id 543, `state='sent'`, `email_from='noreply@v6impresa.it'`. Endpoint di stato confermato `pronto` sia contro Odoo diretto sia attraverso il proxy Next.js locale.

**Cosa NON è stato verificato** (limite onesto, non un successo simulato): nessun test in un browser reale con interazione umana (click su BlurLock, rendering visivo effettivo del blur/colori) — non disponibile uno strumento di automazione browser in questo giro. La verifica sopra copre correttezza dei tipi, delle risposte HTTP reali con dati reali, e il rendering server-side iniziale (shell HTML corretto, stato di caricamento presente), ma non un controllo visivo pixel-per-pixel né l'interazione utente sulla pagina.

Non forzato esplicitamente il caso "timeout scaduto lato frontend con Gate 3B ancora in corso" (il test reale è convergente troppo rapidamente, ~90s, per osservarlo senza modificare artificialmente `WAIT_TIMEOUT_MS < 90000`) — il messaggio statico per quel caso esisteva già (verificato per lettura, non per esecuzione dal vivo in quello specifico ramo) ed è verificato che il codice lo mostra quando `stato !== 'pronto'` dopo la singola chiamata di stato.

## Debito tecnico esplicito

- Confermati invariati: `tech_debt: generativo_non_deterministico` (azioni win-win), stima tempi Gate 3B ancora basata su pochi campioni (questo giro ne aggiunge uno: ~90s con 1 round convergente).
- **Nuovo**: `BlurLock.onUnlock` non collegato a un pagamento reale (mock esistente incompatibile per schema id, integrazione reale fuori scope dichiarato).
- **Nuovo**: nessun test di interazione browser reale (click, rendering visivo) — solo verifica HTTP/TypeScript/SSR.
- **Nuovo, minore**: il ramo "timeout scaduto, Gate 3B ancora in corso" lato frontend non è stato osservato in esecuzione reale (solo per lettura del codice), essendo il caso reale testato convergente più rapidamente della soglia.

## File toccati in questo run (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- **Backend**: `odoo-modules/erpv6_winwin_renderdata/models/report_token.py` (nuovo), `models/__init__.py`, `data/cron_report_token_data.xml` (nuovo), `security/ir.model.access.csv` (nuovo), `__manifest__.py` (dipendenze `mail`/`erpv6_agent` + nuovi data file) — copiati anche in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/`.
- **Gateway**: `odoo-modules/erpv6_api_gateway/controllers/interview_api.py` (token nella risposta), `controllers/winwin_report_api.py` (nuovo), `controllers/__init__.py` — copiati anche in `/opt/erpv6/custom-addons/erpv6_api_gateway/`.
- **Frontend**: `apps/impresa/src/components/interview/InterviewTreeFlow.tsx`, `apps/impresa/src/lib/interview/tree-client.ts`, `apps/impresa/src/middleware.ts` (allowlist), nuovi: `apps/impresa/src/lib/winwin/report-client.ts`, `apps/impresa/src/app/api/winwin-report/{status,data}/route.ts`, `apps/impresa/src/app/report/[token]/page.tsx`.
- Nessun file di altri thread di lavoro toccato (Progetto TEE, `erpv6_typst`/`erpv6_production` di un altro giro — verificato `git status` prima e dopo).
- `package.json`/`package-lock.json` non modificati dall'`npm install` (nessuna dipendenza nuova aggiunta, solo installazione di quelle già dichiarate).

## Dati di test lasciati nel sistema

- Token/ordini di test da giri precedenti (lead 151-156, ecc. — vedi report precedenti).
- Nuovi in questo giro: lead "TEST WEB ASYNC E2E 2" (crm.lead, production.order #71, interview.session #40), token report id 3 (stato `inviato_email`, reale, convergente), token sintetico di test escalation (production.order #69, `erpv6.agent.communication` #19, creato per testare la rete di sicurezza a 30 minuti — non rappresenta un problema reale, è un test deliberato).

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_WEB_ASYNC.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_WEB_ASYNC.md
```
