# Circuito `erpv6_winwin_renderdata` — Report Finale

Branch dedicato: `feature/circuito-winwin-renderdata` (locale, nessun commit fatto, nessun push). Continua da `CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE_BLOCCATO.md` (Fase 1 fatta, Fase 2 bloccata) dopo che l'utente ha deciso: Percorso B (upload bilancio) primario + Percorso A (domande dirette in €) come fallback.

**Stato**: Fasi 1, 2, 3A, 3B fatte e verificate dal vivo con AI reali (non simulate). Fase 4 **parzialmente** fatta: l'arco dati backend (Motore → Gate 3A → Gate 3B → un solo RenderDataFinal → doppia generazione PDF Typst) è reale, testato, funzionante end-to-end. La parte di infrastruttura asincrona (timeout, fallback email con token, polling frontend) **non è stata costruita** — vedi sezione dedicata più sotto per il motivo esatto e cosa serve. Fase 5 (verifica finale) fatta nei limiti di cosa è stato costruito.

---

## Sblocco raccolta dati (prerequisito, prima di Fase 2)

Nuovo modulo `erpv6_winwin_renderdata` esteso (non un modulo a parte) con:

- **Percorso B (upload, primario)**: nuova domanda d'intervista `answer_type='file'` (`bilancio_upload`, XML `data/interview_question_bilancio_data.xml`). Il testo del PDF caricato viene estratto con **PyPDF2** (già presente nell'immagine Odoo, nessuna nuova dipendenza) e passato a un motore AI generico esistente (`erpv6.omni.bridge.execute_ai_task`, stessa route di `_run_metodo_ai`) con un nuovo prompt KB dedicato (`kb_metodo_estrazione_bilancio`, `data/kb_bilancio_extraction_data.xml`) che estrae: fatturato, oneri finanziari, EBITDA, debito finanziario, **patrimonio netto**, **quota capitale rimborsata annua** (questi ultimi due aggiunti da me, vedi sotto il perché), data ultima visura, contenzioso in corso. Regola anti-allucinazione esplicita nel prompt: un campo non trovato o ambiguo resta `null`, mai stimato.
- **Percorso A (domande dirette, fallback)**: 6 nuove domande (`answer_type='number'`/`'date'`/`'select'`), attivate SOLO per i campi che l'estrazione non ha trovato — implementato NON modificando il walker dell'albero (`_find_next_question`, lasciato invariato), ma creando una **risposta automatica** per ogni campo estratto con successo: il walker esistente le salta da solo perché "già risposte", nessuna logica di skip duplicata.
- `bando_target` è sempre chiesta direttamente (non è un dato che un bilancio possa contenere).

**Modelli estesi** (`models/interview_extension.py`): `erpv6.interview.question` (+`file`,`+date`), `erpv6.interview.answer` (+`attachment_id`, +`skipped`), `erpv6.production.order` (+7 campi `interview_*` nuovi).

**Verificato dal vivo con un vero PDF generato via reportlab** (bilancio plausibile, non un payload scritto a mano nei campi finali) e una vera sessione d'intervista eseguita passo-passo con `action_start`/`action_answer` (non scritture dirette nel DB):
- Caso upload completo: tutti i 6 campi estratti correttamente e con i valori esatti del PDF (oneri=95000, ebitda=480000, debito=620000, data=2025-12-31, contenzioso=No, fatturato_esatto=3200000) — intervista terminata subito dopo l'upload, **zero domande di fallback mostrate**.
- Caso skip upload: risposta esplicita `skipped=True` (mai un timeout) → tutte le 5 domande di fallback presentate in sequenza, risposte manualmente, valori scritti correttamente sull'ordine.

### Perché ho aggiunto patrimonio netto e quota capitale (decisione mia, minore, documentata come richiesto)

Con solo oneri finanziari + EBITDA + debito finanziario (l'elenco originale del prompt), **né DSCR né leva finanziaria erano calcolabili con la formula vera**: DSCR richiede anche la quota capitale rimborsata (non solo gli interessi), la leva richiede il patrimonio netto (non solo il debito). Calcolare un proxy (es. EBITDA/oneri finanziari, che è un *interest coverage ratio*, non un DSCR) e mostrarlo sotto l'etichetta "DSCR" sarebbe stato un errore sostanziale sotto un'etichetta corretta — peggio che lasciare il dato assente. Ho quindi aggiunto questi due campi allo stesso meccanismo (estrazione + fallback) invece di fermarmi o di inventare un proxy.

---

## Fase 2 — Motore (`models/aeosv6_dispatch.py`, `_run_winwin_renderdata_build`)

Legge SOLO dati grezzi già raccolti (`interview_*` su `erpv6.production.order`), nessuna classificazione qui. Output: `{raw, missing, diagnosi, criticita, azioni_urgenti}`.

**`_classify()`**: applica le soglie KB (risolte via `node.kb_link_ids[0].resolve_kb()`, mai hardcoded — Fase 1) con formule corrette:
- `DSCR = EBITDA / (oneri finanziari + quota capitale annua)`
- `Leva = debito finanziario / (debito finanziario + patrimonio netto)`

Se un componente manca, la metrica resta **assente** da `diagnosi.metriche` (mai stimata), e il campo mancante è già in `missing`.

**Verificato dal vivo** (nodo `erpv6.core.node` reale via `run_process`, non chiamata diretta alla funzione Python):
- Caso dati completi (EBITDA 480k, oneri 95k, rimborso 250k, debito 620k, patrimonio 380k): DSCR=1.39 (ambra), leva=62.0% (ambra) — matematica verificata a mano, corretta. `missing` corretto (`bando_target`, `fatturato_esatto`, `settore`).
- Caso dati mancanti (senza rimborso_capitale_annuo/patrimonio_netto): `diagnosi.metriche` correttamente **vuoto**, nessuna stima silenziosa.
- Errore esplicito su `production_order_id` inesistente: verificato (`UserError`, non un crash muto).

---

## Fase 3 — Gate a due velocità (`models/gate.py`)

### 3A (leggero) — `_winwin_gate_3a_claims_checked`

Diagnosi/criticità/azioni urgenti sono già deterministiche (calcolate dal Motore da dati raccolti, mai generative) — non ho usato il ciclo pesante 5 analisti + Sesto Uomo per questa sezione (sarebbe stato uno spreco di tempo/budget AI su un controllo già garantito a monte, come indicato nel prompt). Ho implementato il sottoinsieme minimo direttamente (nessuna modalità "quick check" esisteva già in `erpv6.validation`, verificato leggendo il codice): ogni voce di `diagnosi.metriche`/`criticita`/`azioni_urgenti` senza campo `fonte` tracciabile viene scartata (mai lasciata passare senza controllo) e loggata su `message_post`. Nei test reali, il Motore valorizza sempre `fonte`, quindi oggi è una rete di sicurezza silenziosa (0 scarti), non un filtro attivo — corretto e atteso.

### 3B (pesante) — `_winwin_gate_3b_azioni_winwin`

**Scoperta importante durante l'implementazione, risolta da me (decisione minore, documentata)**: il motore generico `erpv6.validation.session` (5 analisti + Sesto Uomo) NON è "dai a 5 analisti lo stesso contenuto e verificalo" — è progettato per "5 analisti producono findings indipendenti dagli stessi dati grezzi, Sesto Uomo concilia le divergenze" (schema di risposta hardcoded `{"findings":...}` in `_run_round`, `erpv6_validation`). Ho quindi implementato: genero il candidato win-win con lo stesso prompt/motore AI di `_run_metodo_ai('winwin')` (duplicato solo il "chiama e fai parsing", non l'intero metodo, perché quello salva subito un documento permanente — non corretto farlo PRIMA della verifica), poi lo faccio verificare (fact-check contro i dati reali, non rigenerare) dai 5 analisti tramite un prompt override dedicato (`Erpv6ValidationSessionWinwinGate._get_analyst_prompt_template`, attivo solo quando la sessione porta un `winwin_gate_candidate`).

**Bug reale trovato e corretto durante il test dal vivo**: il prompt custom conteneva il JSON del candidato con parentesi graffe non "raddoppiate" — `_run_round` chiama `.format()` sul template, e QUALUNQUE graffa non protetta veniva interpretata come placeholder (`KeyError: '"azioni_winwin"'`). Risolto escapando le graffe del JSON incorporato (`.replace('{','{{').replace('}','}}')`) prima di costruire il template.

**Verificato dal vivo con una sessione di validazione REALE (5 analisti + Sesto Uomo, chiamate AI vere, non simulate)**: sessione #385, **convergente al primo round** (nessuna allucinazione rilevata), con contenuto finale concreto e ben ancorato ai dati reali del caso di test (cita EBITDA €480.000, debito €620.000, oneri €95.000, bando "Credito 4.0" — mai generico). Tempo reale della chiamata completa: alcuni minuti (6 chiamate AI sincrone per round). Con un solo round di convergenza osservato su un caso, non ho un campione sufficiente per stimare un numero tipico di round attendibile su casi reali — servirebbe osservare più esecuzioni prima di calibrare la soglia di attesa della Fase 4.

Se la sessione va in escalation umana (mai osservato nel test, ma gestito): nessun bypass, `azioni_winwin` resta assente dal render_data finale, notifica su `message_post`, coerente col principio "FASE"/gate umano del prompt originale sui dati bloccanti.

---

## Fase 4 — Arco (`models/gate.py`, `build_and_validate_render_data` + `generate_winwin_documents`)

### Cosa funziona, verificato dal vivo end-to-end

`build_and_validate_render_data()`: Motore → Gate 3A → Gate 3B (reale) → **un solo `RenderDataFinal`** (campo `erpv6.production.order.winwin_render_data_final`, salvato una volta), con trasformazione dei dati nello schema ESATTO letto dal template Typst reale `WW-STD-001` (verificato leggendo il `typst_source` vero e i blocchi, non assunto): `diagnosi.metriche` come lista (non dict, trasformazione fatta al confine), `impatto`/`prontezza`/`etichetta_azienda` da `erpv6.kairos.matrix` (scaling 0-100 stimato sui range osservati nei dati reali — **approssimazione dichiarata**, nessun campo min/max canonico esiste sul modello Kairós per una conversione esatta), `schede` = le azioni win-win validate dal Gate 3B, `roadmap`/`raccomandazione` lasciati vuoti/`None` (il template li gestisce con `if` difensivi, nessun errore — ma sono contenuto non costruito in questo giro, vedi sotto).

`generate_winwin_documents()`: **due invocazioni reali di `erpv6.typst.engine.generate_document`** sullo stesso `winwin_render_data_final`, differenza solo nel flag `preview`. **Verificato dal vivo**: entrambi i documenti generati con `status='ready'`, PDF reali (39.960 e 45.472 byte), nessun errore — il pattern "un solo RenderDataFinal, due invocazioni" richiesto dal prompt è implementato e funzionante per davvero, non solo teoricamente supportato dal template come confermava l'audit iniziale.

Test eseguito su `erpv6.production.order` #65 (lead di test "TEST CIRCUITO WINWIN v2", intervista reale completata via `action_start`/`action_answer`, non dati scritti a mano) — nel corso del test un `env.cr.commit()` è fallito una volta per `SerializationFailure` (conflitto reale con un cron concorrente sullo stesso database, non un bug del circuito) — gestito con retry, secondo tentativo riuscito.

### Cosa NON è stato costruito (gap onesto, non un successo simulato)

La parte **asincrona** del prompt originale — timeout 15-20s lato utente, continuazione del Gate 3B in background oltre la soglia, generazione di un token univoco non enumerabile, invio email con link, pagina che il link apre — **non esiste**. Motivo verificato, non un'scelta arbitraria: questa istanza Odoo **non ha un job queue** (modulo `queue_job` non installato, verificato interrogando `ir.module.module` — nessun risultato). Il Gate 3B, come costruito, è una chiamata **sincrona e bloccante** che può richiedere qualche minuto (osservato: alcuni minuti per un singolo round convergente) — su una richiesta HTTP reale andrebbe quasi certamente in timeout se lanciata sincronicamente da un click utente.

**Cosa servirebbe per completarlo** (stima onesta, non un impegno):
1. Un meccanismo di esecuzione in background reale lato Odoo — o si installa `queue_job` (OCA, non presente oggi), o si usa un `ir.cron` con polling di stato (meno pulito ma non richiede nuovi moduli: il chiamante lancia il Gate 3B in una transazione separata via un cron "esegui appena possibile", poi un endpoint del frontend fa polling sullo stato della sessione di validazione).
2. Un campo/modello per il token univoco (es. `secrets.token_urlsafe(32)` su un nuovo modello o su `erpv6.production.order` stesso, con scadenza) e un controller pubblico che lo risolve al render_data salvato — non ho trovato un meccanismo di link-con-token già esistente nel progetto da riusare (cercato, non presente).
3. Lato Next.js: una pagina che fa polling sullo stato (es. ogni 2-3s) durante l'attesa, passa al messaggio "te lo mandiamo via email" oltre la soglia, e una pagina `/report/[token]` che mostra la stessa vista blur leggendo dal token invece che dalla sessione corrente.
4. La vista blur pre-pagamento lato web stessa **non esiste ancora in forma collegata** (confermato di nuovo in questo giro: `BlurLock.tsx` resta codice morto, non importato da nessuna pagina — stesso stato rilevato nell'audit "Punto Zero" di questa stessa conversazione, invariato) — costruirla è lavoro aggiuntivo separato da questo circuito backend.
5. Pagamento reale (Stripe) e sblocco: come da audit "Punto Zero", ancora un mock su file JSON locale — invariato, fuori scope di questo giro.

Questo NON è stato affrontato per vincolo di tempo reale in questo giro di lavoro, non per una contraddizione bloccante nei dati — a differenza del blocco della Fase 2 originale, qui la strada è chiara e stimabile, semplicemente non c'è stato spazio per costruirla con lo stesso livello di verifica dal vivo del resto.

### Roadmap e raccomandazione (contenuto mancante, dichiarato)

Il template Typst prevede anche una sezione `roadmap` e una `raccomandazione` finale — nessuna delle due è stata costruita in questo giro (non erano nell'elenco dati richiesto dal prompt originale per la Fase 2/3, e costruirle avrebbe richiesto un'altra decisione di prodotto — quali dati le alimentano, generativo o deterministico). Il template le gestisce correttamente da vuote (nessun errore, sezioni semplicemente assenti dal PDF), quindi il circuito resta funzionante, ma il PDF finale oggi è incompleto rispetto alla visione finale del documento.

---

## Fase 5 — Verifica finale

- **Nessun payload scritto a mano nel percorso di produzione**: tutti i test hanno usato interviste reali eseguite passo-passo (`action_start`/`action_answer`) e un vero PDF di bilancio generato via reportlab, mai valori scritti direttamente per "far tornare" un test.
- **Percorso legacy `/intervista`**: già verificato e confermato corretto/attivo in una parte precedente di questa stessa conversazione (non ricontrollato qui, fuori scope di questo circuito).
- **`tech_debt: generativo_non_deterministico`**: confermato — le azioni win-win restano generative (AI libera sul contesto), ma ora **passano realmente dal Gate 3B** (a differenza della Fase 0, dove non passavano da nessun gate). Il debito residuo è nella natura stessa del contenuto (non deterministico), non più nell'assenza di verifica.
- **Stima round tipici Gate 3B**: 1 solo campione osservato (convergente al primo round) — insufficiente per una stima statistica: servono più esecuzioni su casi reali diversi prima di calibrare con dati la soglia di attesa dei 15-20s della Fase 4 (che comunque non è stata implementata, vedi sopra).
- **Bug reali trovati e corretti in questo giro** (non solo funzionalità nuove): 3 XML con doppio trattino nei commenti (XML non valido), 1 KeyError da graffe JSON non escapate in un f-string di validazione, 1 `SerializationFailure` transitorio gestito con retry.

## Dati di test lasciati nel sistema (da ripulire se non servono)

Lead/production.order di test creati durante questa verifica (nomi tutti prefissati "TEST CIRCUITO WINWIN"): lead id 151-153, production.order id 64-66, interview.session id 35-37, validation.session id 385 (quella convergente, con contenuto reale interessante da rivedere se utile), typst.document id 696-697 (i due PDF generati). Nessuno di questi tocca dati/lead reali di clienti.

## File toccati in questo run (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- `odoo-modules/erpv6_winwin_renderdata/`: esteso con `models/interview_extension.py`, `models/gate.py`, `data/kb_bilancio_extraction_data.xml`, `data/interview_question_bilancio_data.xml`; modificati `models/aeosv6_dispatch.py` (Motore reale), `data/kb_winwin_thresholds_data.xml` (rimosso "(BLOCCATO)" dal nome nodo), `__manifest__.py`, `models/__init__.py`. Copiato anche in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/`.
- Nuovo report: questo file.
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima e dopo: Progetto TEE, `erpv6_typst`/`erpv6_production` modificati da altri, `ADDENDUM.md`/`riepilogo.md` restano intatti e invariati).

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE.md
```
