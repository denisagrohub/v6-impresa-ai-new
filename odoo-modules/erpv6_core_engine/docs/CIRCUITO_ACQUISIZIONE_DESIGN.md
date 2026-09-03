# Circuito Acquisizione — disegno di lavoro (v6impresa.it)

Documento vivo, aggiornato ad ogni passo verificato. Segue il metodo del "generatore di
circuiti" (vedi memoria Claude `project_circuit_generator_method.md`): scopo → step reali →
Motore = una sola azione → interfaccia esatta → verifica se esiste già → costruisci solo il
minimo mancante → test dal vivo con dati fittizi, mai KB/contenuto reale fabbricato.

Stato: **in corso**, 30/08/2026.

---

## Fase 1 — Acquisizione dati minimi

**Scopo**: creare il record cliente (`crm.lead`) dai soli dati identificativi minimi.

**Circuito** (non un solo Motore — `create_lead` reale fa più azioni, da scomporre):
- **Motore IPO — Crea Lead**
  - Scopo: crea record
  - Input: `name` (obbligatorio), `email` (obbligatorio), `company_name`/`phone` (opzionali)
  - Output: `lead_id`
  - Esiste: sì, ma annegato in `erpv6_api_gateway/controllers/lead_api.py:39-155`
    (`create_lead`) insieme ad altre 4 azioni (promozione opportunity, avvio funnel, avvio
    produzione, webhook) — per Fase 1 isolata, il Motore nuovo deve wrappare SOLO
    `env['crm.lead'].sudo().create(vals)`, tipo `'lead'`.
  - **Stato**: [COSTRUITO E VERIFICATO 30/08/2026] `process_key='crea_lead'`, nodo
    `node_fase1_crea_lead` in `circuit_acquisizione_data.xml`. Testato dal vivo (lead
    fittizio creato con `type='lead'`, mai 'opportunity'; errore esplicito su input
    mancante; record di test cancellato subito dopo).

**Gate di entrata Fase 2**: CORRETTO IL 30/08 — non è `action_start()`. La promozione a
opportunity avviene dentro `_complete()` (`interview_engine.py:226-246`) quando le 3
risposte BANT (`tipo_progetto`+`budget`+`tempistiche`) sono tutte presenti — reale, già
collegata, commento esplicito nel codice: "quando risponde a BANT diventa opportunità".
**Problema trovato**: l'ordine reale delle domande (tipo_progetto→destinatario→
tempistiche→budget→fatturato→obiettivi) intercala `destinatario` PRIMA che budget e
tempistiche siano risposte — quindi il BANT non si completa alla 3a domanda dell'albero, si
completa solo alla 4a (budget), con `destinatario` già chiesta in mezzo. Se l'intervista
intelligente deve fermarsi esattamente al BANT, l'albero andrebbe riordinato (BANT prima,
`destinatario`/`fatturato` dopo) — decisione ancora aperta con Denis.

**FRONTEND — corretto il 30/08/2026**: `/intervista` (apps/impresa) era una form statica
VECCHIA e scollegata dall'albero, 5 fasi/19 domande, che duplicava tipo_progetto/
destinatario/tempistiche/budget/obiettivi GIÀ presenti nell'albero vero
(`/intervista/guidata`, `InterviewTreeFlow.tsx`). Riscritta: ora chiede solo le 4 domande di
Fase 1 (nome/email/telefono/azienda) poi va DIRETTAMENTE a `/intervista/guidata` (che ha
già, in modo migliore, la sua selezione prodotto/verticale reale via
`selectedVariantId`/`selectedProductId`→`verticale_id`, mai duplicata nella vecchia form).
Rimosso codice morto (altre 4 fasi, scoring client-side, vista risultati interna) dopo aver
verificato che nessun altro file dipendeva da quelle parti. TypeScript verificato pulito.

**[CONFERMATO DAL VIVO DA DENIS, 30/08/2026]**: testato via tunnel SSH sul dev server locale
(porta 3000, non il sito pubblico Vercel non ancora aggiornato) — Fase 1 completa le 4
domande e passa correttamente a Fase 2 (intervista ad albero). Fase 1 è quindi verificata
sia in automatico (odoo shell, dati fittizi) sia manualmente dall'utente reale.

**Bug reale trovato e corretto durante il test dal vivo**: `NEXT_PUBLIC_ODOO_URL` mancante
in `.env.local` (il codice legge quella variabile, non `ODOO_URL`) — il catalogo verticali
cadeva su un default hardcoded sbagliato (`agrohub.odoo.com`, un'altra istanza Odoo).
Corretto, catalogo dei 15 verticali reali ora funzionante in `/intervista/guidata`.

**Correzione di design confermata da Denis**: la domanda "che tipo di prodotto ti
interessa?" era etichettata "(opzionale)" — sbagliato, deve essere "A che settore
appartiene la tua azienda?" ed è OBBLIGATORIA (senza verticale scelto, KB/adattamento per
settore non possono mai funzionare). Corretto in `InterviewTreeFlow.tsx`: label cambiata,
validazione bloccante aggiunta in `handleStart()`.

**[CONFERMATO DAL VIVO 30/08/2026]**: intero percorso end-to-end testato da Denis —
Fase 1 (nome/email/telefono/azienda) → settore obbligatorio (Agricoltura e Agroalimentare
scelto) → `POST /api/interview-tree/start` riuscito → prima domanda reale dell'albero
(tipo di progetto) mostrata a schermo.

---

## Fase 2 — Intervista intelligente

**Scopo**: raccogliere i dati veri del progetto, mostrando Kairós in tempo reale.

Le 6 domande reali esistenti (nessuna con `verticale_id` valorizzato — gap, vedi sotto):
`tipo_progetto` (5 opzioni), `destinatario` (4), `tempistiche` (4), `budget` (4),
`fatturato` (4), 1 domanda a testo libero (obiettivi).

**[FATTO E VERIFICATO DAL VIVO 30/08/2026] Loop Kairós**: ogni risposta con `field_key` ora
scrive subito `interview_<field_key>` su `production_order` (prima solo a `_complete()`,
fine intervista) e richiama `_compute_kairos_matrix()` — vedi
`interview_engine.py::_sync_answer_and_score()`, chiamato da `action_answer()`.

**Loop ricorsivo — due input, non una media**: corretto un mio errore (avevo inventato una
media pesata tra punteggio vecchio/nuovo, mai richiesta — Denis: "nessuno te lo ha chiesto").
La soluzione reale: `erpv6.kairos.matrix` ha già un campo proprio mai usato,
`previous_matrix_id` ("Valutazione Precedente") — `_compute_kairos_matrix(previous_matrix=…)`
ora, quando riceve il secondo input, CREA una nuova valutazione agganciata alla precedente
(mai sovrascritta) invece di fondere i punteggi. Quadrante/prontezza restano calcolati
onestamente solo dai dati del giro corrente. Comportamento invariato per ogni altro
chiamante (es. `_promote_to_opportunity`) che non passa `previous_matrix`.
Verificato dal vivo: giro 1 crea matrice (previous_matrix_id vuoto), giro 2 crea una
matrice NUOVA agganciata alla prima (che resta intatta) — catena vera confermata.
`interview_api.py` aggiornato per restituire lo score ad ogni risposta, non solo a fine
intervista.

**Lezione da questa correzione**: prima di scrivere QUALSIASI logica di combinazione/
calcolo, controllare se il modello del Motore ha già un campo/metodo pensato per quello —
non inventare un algoritmo (media, pesi, ecc.) mai richiesto esplicitamente.

**Gap noti**: nessuna delle 6 domande ha `verticale_id` — il meccanismo di adattamento
(`matches_verticale`) è reale e funzionante ma senza contenuto da adattare.

**[DECISIONE ARCHITETTURALE 30/08/2026] Selezione settore = un circuito, non un modello a
parte.** `erpv6.vertical.catalog` supporta solo 2 livelli (dominio `parent_id` limitato a
radici) e selezione singola — ma Denis ha chiarito la vera tassonomia necessaria, a 4
livelli, multi-selezionabile: **Agroalimentare** (L1) → **Allevamento / Ortaggi / Cereali**
(L2, selezione multipla — es. Allevamento+Cereali insieme) → se Allevamento: **da latte /
da carne** (L3) → specie (L4: da latte = bovino/ovino/caprino; da carne =
bovino/caprino/ovino/avicolo/suino/equino).

"Abbiamo fatto il grafo apposta per fare questo" (Denis) — `erpv6.core.node` supporta già
profondità/ramificazione arbitraria (parent_id/child_ids ricorsivo, nessun limite artificiale
come `erpv6.vertical.catalog`), quindi la selezione del settore diventa essa stessa un
circuito. **Decisione confermata**: è un LIVELLO NUOVO che affianca il vecchio catalogo
(non lo sostituisce) — `erpv6.vertical.catalog` resta com'è, usato oggi in più punti reali
(domande intervista, sessione, competenze consulente, categorie KB), nessuna migrazione di
quei punti per ora.

**Non ancora iniziato**: progettare/costruire questo circuito di selezione settore
(nodi per Agroalimentare→Allevamento→da latte/da carne→specie, come primo ramo reale di
prova) e capire come si collega alla sessione d'intervista esistente (`verticale_id`).

---

## Fase 3 — Circuito Metodo (relazione Win-Win, gratuita)

**Due prodotti distinti, mai confondere** (vedi mappa completa in memoria Claude):
- **Win-Win** (questo circuito): scopo fisso — fattibilità + azioni, destinatario SEMPRE il
  cliente (già fissato nel prompt reale KB #482, "scrivi come se stessi già scrivendo per
  lui") — indipendente da cosa risponde l'utente su `destinatario`.
- **Business Plan** (prodotto a pagamento, downstream, fuori scope qui): scopo/destinatario
  VARIABILI da `tipo_progetto`/`destinatario` — Banca ≠ Investitore ≠ Partner.

**Circuito Metodo Win-Win**, nodi atomici (nessuno ancora costruito come Motore registrato):
1. Motore — Risolvi KB Psicologica (esistono 157 voci reali, Sakshi — metodo di
   risoluzione esatto NON ANCORA definito/verificato)
2. Motore — Risolvi KB Marketing (**contenuto inesistente**, `kb_type='commerciale'` vuoto)
3. Motore — Risolvi KB Verticale (**contenuto inesistente**, 86 categorie, zero con
   `verticale` valorizzato — 15 verticali reali del catalogo, nessuno collegato a KB)
4. Motore AIPO — Applica il Metodo (reale: `_run_metodo_ai('winwin')`,
   `production_order.py:1180-1253` — prompt reale KB #482 verificato, anti-allucinazione
   integrata; MANCA template Typst collegato, oggi salva `.md` grezzo)
5. Motore — Decidi Oscuramento (**non progettato**, nessun meccanismo esiste)

---

## Bivio a 3 vie (dopo la relazione)

Nodo mai modellato nel sistema — richiede estendere `erpv6.core.node`/`erpv6.core.arc`.
- Sblocca report (49€, Stripe Payment Link) — **nuovo**
- Fissa una call — **esiste già** (`erpv6.booking.token`/`action_book`,
  `/api/v1/booking/*`), solo da collegare
- Acquista Business Plan — esiste ma rotto (`prodotto_id` mai scritto in nessun punto del
  codice, verificato con grep esaustivo)

---

## Log verifiche (cosa è stato controllato dal vivo, con data)

- 30/08: 6 domande intervista reali, contate ed elencate (query diretta DB).
- 30/08: 15 verticali reali in `erpv6.vertical.catalog`, zero con figli, zero collegati a
  domande o a categorie KB.
- 30/08: `kb_type='commerciale'` esiste nel motore KB ma zero voci reali.
- 30/08: `erpv6.booking.token`/`action_book` confermato reale e funzionante.
- 30/08: `prodotto_id` su `erpv6.production.order` mai scritto in nessun punto del
  codebase (grep esaustivo).
- 30/08: `action_start()` NON chiama `_promote_to_opportunity()` — verificato leggendo il
  codice, non ancora collegato.
- 30/08: prompt reale Win-Win (KB #482) letto per intero — destinatario fissato al
  cliente, schema JSON attuale (`azioni_winwin`/`sintesi_per_il_cliente`/
  `flagged_missing_data`) diverso da quello richiesto per l'oscuramento
  (`criticita`/`azioni_urgenti`/`opportunita`).
