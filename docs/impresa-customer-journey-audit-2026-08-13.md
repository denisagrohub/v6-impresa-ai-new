# Audit customer journey — apps/impresa — 2026-08-13

Analisi statica del codice (nessuna modifica a file esistenti, nessuna scrittura sul database). Copre il percorso reale di un visitatore: homepage → CTA → `/intervista` → invio lead → dashboard consulente → generazione business plan. Incrocia i risultati con `docs/api-gateway-audit-2026-08-12.md`.

**Nota preliminare sulla struttura**: `apps/impresa` come directory non esiste sul branch corrente (`fix/admin-permission-checks-2`). CLAUDE.md descrive una struttura Turborepo multi-brand (`apps/`) che vive solo su `feature/turborepo-migration`. Sul branch attuale il frontend "V6 Impresa AI" (brand `progetto-impresa`) è alla radice del repo, sotto `src/`. Ho trattato `src/` come "apps/impresa" ai fini di questo audit — è l'unico frontend presente e corrisponde al brand richiesto.

---

## Mappa del percorso reale

```
Homepage (src/app/page.tsx)
  │  3 CTA identiche → <Link href="/intervista">  (+ una variante ?assessment=true)
  ▼
/intervista (src/app/intervista/page.tsx)
  │  5 fasi di domande, score calcolato IN LOCALE da src/lib/interview/interview-engine.ts
  │  (nessuna chiamata AI/Odoo per lo scoring, nonostante l'homepage reclamizzi "AI Co-pilot")
  ▼
submitAnswers() → POST /api/leads (route Next.js locale, NON il gateway Odoo)
  │  fetch() mai controllato (né status né corpo) → schermata "🎉 Intervista Completata!"
  │  mostrata SEMPRE, indipendentemente dall'esito reale della POST
  ▼
src/app/api/leads/route.ts → saveLead() in src/lib/lead-queue.ts
  │  in teoria: Odoo abilitato → callOdooAPI() (src/lib/odoo-adapter.ts) → gateway Odoo
  │             Odoo disabilitato → coda locale src/data/pending-leads.json
  ✗  in pratica: nessuno dei due percorsi funziona (dettagli Tappa 3)

--- percorso separato, non raggiunto dall'intervista ---

/login (credenziali hardcoded in chiaro nel JSX) → localStorage "pi_session"
  ▼
/consultant/dashboard
  │  data = mockData SUBITO al mount; poi fetch reale a /api/consultant/dashboard
  │  se l'utente ha clientId (sempre, per l'utente demo consulente)
  ✗  fetch reale fallisce sempre (bug requirePermission, dettagli Tappa 4) → mock resta a schermo, nessun avviso
  │
  ├─ tab "Progetti" → /consultant/project-progress?id=... → /api/leads (GET), /api/kb, /api/appointments, /api/call/*
  │                    tutte route locali senza alcun controllo Odoo (confermano Fase E dell'audit di ieri)
  └─ "Vedi dettagli" business plan → /consultant/bp-review?bpId=... o /bp/review?id=...
       │  GET /api/bp/[id]  ← QUESTA ROUTE NON ESISTE nel codice
       ✗  fetch fallisce (404) → .json() lancia → catch() → dati demo hardcoded ("Innovazione S.r.l.")
       │
       └─ /bp/delivery?id=... → GET /api/bp/[id]/delivered  ← ANCHE QUESTA NON ESISTE
            ✗ stesso pattern: 404 → catch() → demo hardcoded

Generazione documento BP: src/app/api/projects/[projectId]/bp-sections/route.ts
  ✗  nessuna chiamata a erpv6_typst, nessuna chiamata AI — solo file locale se esiste
     (nessuno esiste: src/data/projects/ non esiste), altrimenti HTML hardcoded
```

---

## Tappa 1 — Homepage → CTA `/intervista`

**Classificazione: (a) collegato e funzionante.**

`src/app/page.tsx` — tre `<Link href="/intervista">` (una con `?assessment=true`). Nessuna dipendenza da Odoo in questa tappa: sono semplici link Next.js. Nessun problema da segnalare.

Nota a margine: le affermazioni di marketing sulla pagina ("Business Plan generato in 5 minuti", "AI Co-pilot", "500+ clienti soddisfatti") non hanno riscontro nel codice verificato nelle tappe successive — non è un bug di questa tappa, ma il contesto che rende più rilevanti i risultati di Tappa 2 e 5.

---

## Tappa 2 — Compilazione intervista e calcolo score

**Classificazione: (c) non collegato, gira solo su motore locale — ma per progetto, non per bug.**

`src/lib/interview/interview-engine.ts` calcola lo score (`InterviewEngine.calculateScore`) con mappe di punteggio hardcoded (fatturato, dipendenti, budget, tempistiche...) interamente **client-side**. Non c'è nessun endpoint che questo motore dovrebbe chiamare e non chiama — è cablato così by design, non è un fallback silenzioso su un flag `USE_ODOO`. Lo segnalo solo perché contraddice la promessa "AI in tempo reale" mostrata nell'hero della homepage: lo scoring non usa AI né dati Odoo, è un motore di regole locale.

---

## Tappa 3 — Invio del lead (il punto più critico del percorso)

**Classificazione: (b) — il lead non viene MAI salvato, in nessuna configurazione, ma l'utente vede sempre successo.**

Questa è la scoperta più seria dell'audit: una catena di **quattro bug indipendenti**, ciascuno sufficiente da solo a rompere il flusso, che si sommano.

1. **Mismatch di payload frontend↔route.** `src/app/intervista/page.tsx` invia a `POST /api/leads` un oggetto piatto (`{source, package, packageId, ...fullAnswers, score, recommendedLevel, estimatedPrice, timestamp}`). `src/app/api/leads/route.ts` invece destruttura `const { source, data } = body` e richiede `data` — che non viene mai inviato. La route risponde sempre `400 {error: 'source e data sono obbligatori'}`.

2. **Il frontend ignora la risposta.** In `submitAnswers()`, il risultato di `await fetch('/api/leads', ...)` non viene mai assegnato né controllato (né `response.ok`, né il corpo). Subito dopo, `setSubmitted(true)` viene chiamato incondizionatamente (nel blocco `try`, non dipende dall'esito della fetch). L'utente vede sempre "🎉 Intervista Completata!" con punteggio e pacchetto consigliato, anche se il lead non è stato salvato da nessuna parte.

3. **Anche correggendo (1): la coda locale è rotta.** Se `isOdooEnabled()` è `false` (default, verificato in `secure-config.json`: `useOdoo: false`), `saveLead()` in `src/lib/lead-queue.ts` chiama `saveLeadToQueue()`, che fa `fs.readFileSync('src/data/pending-leads.json')`. **Questo file non esiste e non è mai esistito** (verificato: nessun file sul disco, nessuna occorrenza in `git log --all` per quel path). La lettura lancia `ENOENT`, l'eccezione non è gestita dal chiamante (né nel branch "Odoo non abilitato" né nel branch "Odoo down, fallback a coda" di `saveLead()`) e si propaga come `500` non gestito.

4. **Anche correggendo (3): il path Odoo è sbagliato.** Se Odoo fosse abilitato, `saveLead()` chiama `callOdooAPI('/api/leads', ...)` — ma il vero endpoint del gateway (verificato oggi in `odoo-modules/erpv6_api_gateway/controllers/lead_api.py`) è `/api/v1/leads`, non `/api/leads`. Il path corretto esiste già, ma in un'altra funzione dello stesso file `odoo-adapter.ts` — `syncLeadToOdoo()` — che però **non ha nessun chiamante in tutto il repo** (confermato via grep e dal commento esplicito lasciato nel codice). Le due funzioni non sono mai state fatte convergere.

5. **Anche correggendo (4): i nomi dei campi non combaciano.** `lead_api.py` sul lato Odoo richiede `name` ed `email` (in inglese: `data.get('name')`, `data.get('company_name')`) e risponde `400` se mancanti. L'intervista produce `nome` e `azienda` (in italiano, vedi `InterviewAnswer` in `interview-engine.ts`). Anche con (1)+(3)+(4) risolti, la creazione del lead fallirebbe comunque per il nome campo sbagliato.

**Nota positiva, per completezza**: `src/lib/odoo-adapter.ts` stesso — il livello più basso, quello corretto ieri nella sessione precedente — oggi risulta scritto bene: `callOdooAPI()` propaga davvero errori di rete/timeout/HTTP non-2xx invece di fabbricare `{success: true}`, e sia `syncLeadToOdoo()` che `getOdooPartners()` falliscono esplicitamente in modalità reale invece di restituire finti successi. Il problema non è più lì — si è spostato un livello sopra: nel path sbagliato usato da `lead-queue.ts`, nel file di coda mai creato, e nella pagina `/intervista` che non controlla mai l'esito della propria chiamata.

**Nota collaterale**: `src/app/intervista/risultati/page.tsx` esiste ma è completamente orfana — legge `sessionStorage.getItem('interviewData')`, una chiave che nessun punto del codice scrive mai, e nessun link nel repo punta a `/intervista/risultati`. Se raggiunta direttamente mostra sempre "Nessun dato trovato". Non impatta il percorso reale (che mostra i risultati inline in `/intervista`), ma è codice morto.

---

## Tappa 4 — Dashboard consulente

**Classificazione: (b) per il fetch reale (bug di permessi che nega sempre l'accesso, mascherato); (c) per il fallback mock che lo nasconde.**

**Login** (`src/app/login/page.tsx`): tre credenziali hardcoded nel codice client (`admin@progettoimpresa.it/admin123`, `demo@progettoimpresa.it/demo123`, `christian@progettoimpresa.it/consultant123`), mostrate esplicitamente in UI come suggerimento demo. Nessuna verifica server-side, nessuna chiamata a `res.users` di Odoo (l'endpoint gateway `/api/v1/users/me` esiste ma non viene mai chiamato dal login). `client-login/route.ts` esiste come alternativa server-side ma legge da `src/data/clients.json`, anch'esso locale — e comunque il login usato nella UI reale (`/login`) non lo chiama.

**Dashboard** (`src/app/consultant/dashboard/page.tsx`):
- Al mount, `data` viene impostato **subito** a `mockData` — due progetti finti, timesheet finto, provvigioni finte, tutto hardcoded nel componente.
- Se `user.clientId` esiste (vero per l'utente demo consulente, `clientId: "PART-004"`), parte un fetch reale a `GET /api/consultant/dashboard`.
- Quella route (`src/app/api/consultant/dashboard/route.ts`) chiama `requirePermission(request, ['consultant.view_own_dashboard'])`. Il problema: `requirePermission()` (in `src/lib/auth.ts`) confronta la lista di permessi passata con `session.role` — ma i ruoli reali del sistema sono `admin`/`client`/`consultant`/`chief`, mai una stringa granulare come `'consultant.view_own_dashboard'`. Il confronto fallisce **sempre**, per qualunque ruolo, e la funzione ritorna un `NextResponse` 403 invece del vero oggetto sessione.
- Il chiamante non controlla `instanceof NextResponse` sul valore di ritorno — a differenza di **tutte** le route `/api/admin/*` più recenti (es. `admin/partners/route.ts`), che fanno correttamente `if (permissionCheck instanceof NextResponse) return permissionCheck;`. Qui invece il codice prosegue trattando l'oggetto risposta come se fosse la sessione utente, quindi il controllo di ownership successivo (`data.consultant.id !== user.id && user.role !== 'admin' && ...`) risulta sempre vero anche per errore di tipo, e la route restituisce comunque un secondo `403 {error: 'Non hai accesso a questi dati'}` — a **qualunque** consulente, sempre, anche loggato correttamente.
- Sul frontend, il fetch fallito viene solo loggato in console (`.catch(err => console.error(...))`); `data` resta quello di `mockData` impostato all'avvio. **L'utente non vede mai un errore**: vede sempre e solo i due progetti finti, il timesheet finto, le provvigioni finte, in modo indistinguibile da dati reali.
- Anche se la route fosse raggiungibile, comunque legge incondizionatamente `src/data/consultant-mock.json` — zero controllo `isOdooEnabled()`/`USE_ODOO`, coerente con la Fase E dell'audit di ieri (questa route era già in quella lista).
- Tab "Timesheet": il pulsante "Salva Ore" non ha nessun gestore `onClick` — non tenta nemmeno di salvare, form puramente decorativo.
- Tab "Calendario" (`/api/consultant/calendar`) e "Richieste" (`/api/consultant/requests`): stesso pattern di `dashboard` — nessun controllo Odoo, lettura incondizionata di JSON locali (`consultant-calendar.json`, `requests.json`).
- "Vedi dettagli" progetto → `/consultant/project-progress` → chiama `GET /api/leads`, `/api/kb`, `/api/appointments`, `/api/call/schedule`, `/api/call/room` — tutte route senza alcun controllo Odoo, confermano ulteriormente la Fase E di ieri.

**Scoperta collaterale, più seria di quanto richiesto da questo audit** (trovata seguendo lo stesso pattern `requirePermission` sulla dashboard): due route usano `requirePermission(...)` **senza mai usare il valore di ritorno**:
- `src/app/api/admin/settings/route.ts` (GET/PUT) — legge/scrive `secure-config.json`: URL Odoo, DB, API key Odoo, flag `useOdoo`, chiavi dei provider AI (Anthropic, Groq).
- `src/app/api/call/ai-provider/route.ts` (POST) — cambia il provider AI attivo.

In entrambi i casi `requirePermission(request, ['settings.configure_system'])` costruisce un `403` internamente (stessa causa: stringa di permesso che non corrisponde a nessun ruolo), ma quel valore viene scartato — **il codice prosegue comunque**, senza aver mai verificato chi sta chiamando. L'effetto è l'opposto di quello sulla dashboard consulente: lì l'errore *nega* sempre l'accesso (mascherato dal mock); qui l'errore viene *ignorato* e l'endpoint resta di fatto **privo di controllo accessi reale** — chiunque lo raggiunga, autenticato o no, può leggere/scrivere la configurazione Odoo di produzione. Vale la pena segnalarlo esplicitamente, sullo stesso principio per cui ieri lo stub di `odoo-adapter.ts` è stato segnalato come "più serio del richiesto": qui il problema non è "non è collegato a Odoo", è un controllo di accesso reale che non controlla nulla.

---

## Tappa 5 — Generazione business plan

**Classificazione: (c) — nessuna generazione reale, in nessun punto del percorso.**

- **Nessuna chiamata a `erpv6_typst`** (`/api/v6/typst/*`, il modulo Odoo che genera davvero i documenti — motore reale, verificato ieri come funzionante ma scoperto dal gateway) da nessuna parte nel frontend. Conferma odierna, specifica sul lato "generazione BP" del customer journey, di quanto già rilevato in Fase B dell'audit di ieri.
- **Nessuna chiamata a un provider AI** (Anthropic/Groq/OpenAI) per generare contenuti di business plan. Gli unici endpoint che toccano un provider AI sono sotto `/api/call/*` (trascrizione/analisi delle chiamate vocali con i consulenti) — un'area completamente diversa, scollegata dalla generazione del documento.
- `GET /api/projects/[projectId]/bp-sections` (`src/app/api/projects/[projectId]/bp-sections/route.ts`): se non esiste un file locale `src/data/projects/<id>/sections.json` — **non ne esiste nessuno**, la cartella `src/data/projects/` non esiste sul disco — restituisce HTML hardcoded identico per qualunque progetto (Executive Summary/Analisi di Mercato/Modello Finanziario con numeri fissi, azienda cliente sempre "Innovazione S.p.A./S.r.l.").
- `/bp/review` e `/consultant/bp-review` chiamano `GET /api/bp/[id]` per caricare il business plan da revisionare — **questa route non esiste nel codice** (`src/app/api/bp/[id]/route.ts` non c'è; sotto `/api/bp/[id]/` esistono solo `approve/route.ts` e `consultant-review/route.ts`). Il fetch riceve un 404, `.then(res => res.json())` lancia sul corpo non-JSON dell'errore, il `.catch()` sostituisce con dati demo hardcoded identici indipendentemente dall'`id` richiesto ("Innovazione S.r.l. - Business Plan V6").
- `/bp/delivery` chiama `GET /api/bp/[id]/delivered` — **anche questa route non esiste** (nessuna cartella `delivered` sotto `/api/bp/[id]/`). Stesso pattern esatto: 404 → eccezione nel parsing → fallback silenzioso a dati demo.
- Le uniche due route reali sotto `/api/bp/[id]/` (`approve`, `consultant-review`) scrivono uno stato di approvazione — ma dato che la lettura a monte (`GET /api/bp/[id]`) non esiste, qualunque "approvazione" nella UI reale sta operando su un oggetto che non è mai stato caricato da nessun backend, solo dal fallback client-side.

---

## Incrocio con l'audit gateway di ieri

| Tappa del percorso | Route gateway Odoo rilevante | Esiste ed è funzionante (verificato oggi)? | Viene mai chiamata dal frontend in *questo* percorso? |
|---|---|---|---|
| Invio lead (fine intervista) | `POST /api/v1/leads` (`lead_api.py`) | ✅ Sì — crea davvero un `crm.lead`, gestisce duplicati (`409`), campi Fenice opzionali via `hasattr`, avvia il funnel, notifica webhook | ❌ No — nessun chiamante reale nel percorso; `syncLeadToOdoo()` (unico punto con il path corretto) non ha chiamanti; `lead-queue.ts` chiama il path sbagliato `/api/leads` |
| Dashboard consulente — identità utente | `GET/PUT /api/v1/users/me` (`user_api.py`) | Non ri-verificato oggi in dettaglio (già mappato ieri) | ❌ No — login è hardcoded lato client, non chiama mai questo endpoint |
| Dashboard consulente — progetti assegnati | `GET /api/v1/projects[/<id>]` (`project_api.py`) | ✅ Sì — verificato oggi: interroga `crm.lead` filtrato per `partner_id` dell'utente autenticato, restituisce stage/expected_revenue/probability | ❌ No — la dashboard consulente legge `src/data/consultant-mock.json`, mai `/api/v1/projects` |
| Business plan — generazione documento | Nessuna rotta nel gateway; il motore reale è `erpv6_typst` (`/api/v6/typst/*`), **fuori** dal gateway | Modulo presente (verificato ieri), ma né il gateway né il frontend lo chiamano | ❌ No |
| Business plan — contenuti generati da AI | `POST /api/v1/ai/chat` (`ai_api.py` → `erpv6_omni_bridge`) | ✅ Oggi risulta corretto: delega davvero a `erpv6_omni_bridge.execute_ai_task()` con autenticazione e rate limiting propri (il bug di ieri sul modello `erpv6.omni.bridge` inesistente risulta risolto) — ma comunque pensato per chat/completion generica, non per generazione BP strutturata | ❌ No — nessuna pagina del percorso BP chiama questo endpoint |

**Osservazione centrale**: in almeno due tappe su cinque (lead, progetti) l'endpoint Odoo corretto esiste già **ed è stato verificato oggi come funzionante**. Il problema non è "Odoo non è pronto" — è che il frontend non lo chiama mai, lo chiama con il path sbagliato, o lo chiamerebbe con un payload dal nome dei campi incompatibile.

---

## Riepilogo esecutivo

- **Nessuna delle 5 tappe del percorso è collegata a Odoo in modo funzionante end-to-end**, nonostante in 2 casi su 5 (lead, progetti consulente) l'endpoint gateway corretto esista già e sia stato verificato oggi come operativo.
- **Tappa più critica: l'invio del lead a fine intervista non salva mai nulla**, in nessuna configurazione (Odoo attivo o no) — quattro bug indipendenti in sequenza (mismatch payload, fetch mai controllata, file di coda locale mai creato, path Odoo sbagliato), più un quinto strato di mismatch nei nomi dei campi (italiano vs inglese) che emergerebbe se i primi quattro fossero risolti. L'utente finale vede sempre "Intervista Completata!" a schermo.
- Il pattern "finto successo silenzioso" isolato ieri in `odoo-adapter.ts` (oggi confermato **corretto** in quel file) si è ripresentato, nello stesso spirito, in almeno tre punti indipendenti e diversi: `intervista/page.tsx` (ignora lo status della fetch), `consultant/dashboard/page.tsx` (mostra sempre il mock impostato all'avvio se il fetch reale fallisce, senza mai segnalarlo), `bp/review` + `bp/delivery` (stesso fallback silenzioso su una route che risponde 404 perché non esiste).
- **Scoperta più seria di quanto richiesto da questo audit**: il controllo permessi `requirePermission()` è usato in modo incoerente in `src/app/api/`. Tre route (`consultant/dashboard`, `call/ai-provider`, `admin/settings`) passano stringhe di permesso granulare (es. `'consultant.view_own_dashboard'`, `'settings.configure_system'`) che non corrispondono a nessun `role` reale del sistema (`admin`/`client`/`consultant`/`chief`), a differenza di tutte le route `/api/admin/*` più recenti che passano correttamente i ruoli stessi e controllano `instanceof NextResponse` sul risultato. L'effetto pratico diverge per caso: nella dashboard consulente **nega sempre l'accesso** (mascherato dal fallback mock, quindi invisibile); in `admin/settings` e `call/ai-provider` il diniego viene **costruito ma mai restituito**, lasciando di fatto senza controllo di accesso un endpoint che legge/scrive `useOdoo`, URL/DB/API key di Odoo e chiavi dei provider AI in `secure-config.json`. Dato che questo repo è sullo stesso branch (`fix/admin-permission-checks-2`) dedicato proprio a bug di questa famiglia, è probabile che sia già nel radar — ma questi tre casi specifici non risultavano nella lista `/api/admin/*` già corretta.

*Limiti di questa analisi*: non ho ri-verificato in profondità ogni singola route toccata tangenzialmente (es. `/api/appointments`, `/api/kb`, `/api/call/schedule` in `project-progress`) — dove citate, l'assenza di controllo Odoo è dedotta dalla Fase E dell'audit di ieri (che le elenca esplicitamente) più una verifica di superficie oggi, non da una lettura riga-per-riga di ciascun file. Non ho testato nulla a runtime (nessun server avviato, nessuna chiamata HTTP reale) — tutte le conclusioni derivano da lettura statica del codice.
