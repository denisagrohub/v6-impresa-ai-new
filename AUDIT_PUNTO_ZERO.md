# PUNTO ZERO — Verifica stato sistema ERPv6 (Typst / Kairós / Intervista / Vista Blur)

Audit di sola lettura eseguito il 2026-09-05 su Odoo 18 (container `odoo`, db `erpv6`) e sul repo `erpv6-src` (branch `feature/impresa-redesign-v3`). Nessuna modifica effettuata.

---

## 1. MODULO TYPST

- `erpv6.typst.template`, `erpv6.typst.document`, `erpv6.typst.engine`, `erpv6.typst.template.block`: **esistono e sono installati** (verificato via `env[model]._fields` nel DB reale, non solo nel codice sorgente).
- `erpv6.typst.library` (nome esatto richiesto): **NON TROVATO**. Esiste invece `erpv6.library.document` in un modulo separato (`erpv6_library`), usato come storage dei blocchi Typst tramite `erpv6.typst.template.block.library_document_id`.
- Template `code="WW-STD-001"` (id=19, "Relazione Win-Win Standard"): 7 blocchi in sequenza —
  - seq 0 → `00_palette.typ` (id 81)
  - seq 10 → `10_copertina.typ` (id 82)
  - seq 20 → `20_quadrante.typ` (id 83)
  - seq 30 → `30_diagnosi.typ` (id 84)
  - seq 40 → `40_criticita.typ` (id 85)
  - seq 50 → `50_scheda_azione.typ` (id 86)
  - seq 60 → `60_roadmap.typ` (id 87)
- Documenti più recenti: gli ultimi 10 sono TUTTI per `res_model='crm.lead'`, template WW-STD-001 (id 686-695), 4 con `status='failed'` e 6 `'ready'`. **Bug minore**: `page_count` è sempre `0` anche sui documenti `ready` con PDF reale generato (es. id 695, 50568 byte decodificati) — campo mai calcolato dopo il render.

## 2. MOTORE KAIROS

- 31 matrici totali in `erpv6.kairos.matrix`. **Il lead 122 NON ha nessuna matrice** (`res_model='crm.lead', res_id=122` → 0 risultati) e **non ha nessuna sessione d'intervista** (`erpv6.interview.session` per `lead_id=122` → 0 risultati).
- **Fallback usato**: lead **149** ("Lead Web: as"), sessione intervista id 34 (`state='completed'`), matrice id 46 (`res_model='erpv6.production.order', res_id=63` — **non punta mai direttamente a crm.lead**, ma alla `erpv6.production.order` collegata): `matrix_type='finanziario'`, `impatto_score=2` (livello 'basso'), `prontezza_totale=8` (livello 'bassa'), `quadrante='parcheggio'`, indicatori 1-5 = [2,1,2,1,2].
- **Creazione matrice**: metodo Python `production_order.py:189` `_compute_kairos_matrix(previous_matrix=None)`, motore generico di `erpv6_methodology` (non reimplementato). Chiamato da `interview_engine.py` (`erpv6.interview.session._sync_answer_and_score`, dopo OGNI risposta con `field_key`, non solo a fine intervista) e da `crm_lead.py` (`_promote_to_opportunity`, alla qualificazione del lead). Mapping risposta→punteggio esternalizzato in `erpv6.kairos.scoring.rule` (dati, non codice).
- **Dove appare il risultato a fine intervista**: SOLO nella UI React (`InterviewTreeFlow.tsx`, step `'completed'`) — mostra `quadrante_label`, `impatto_level`, `prontezza_level` come testo semplice, poi il messaggio "Un consulente riceve le tue risposte e ti ricontatta". Nessun controller Odoo espone questo dato oltre l'endpoint che l'ha già restituito durante l'intervista stessa.

## 3. INTERVISTA

- Modello reale: `erpv6.interview.question` (albero, `parent_id`/`child_ids`), `erpv6.interview.question.option`, `erpv6.interview.session` (stato draft/in_progress/completed, `lead_id`, `kairos_matrix_id`), `erpv6.interview.answer` — tutti in `erpv6_production/models/interview_engine.py`.
- Le risposte si salvano su `erpv6.interview.answer` (`session_id`, `question_id`, `option_id` o `value_text`, `is_altro`). Se la domanda ha `field_key`, il valore viene scritto ANCHE su `erpv6.production.order.interview_<field_key>` (es. `interview_budget`).
- Frontend reale e collegato: `/intervista/guidata` (componente `InterviewTreeFlow.tsx`) → proxy Next.js (`/api/interview-tree/start`, `/answer`) → `callOdooAPI('/api/v1/interview/start')` → Odoo. Connessione verificata onesta: se Odoo non risponde, propaga l'errore, non finge un successo.
- **Esiste un secondo percorso "intervista" completamente scollegato**: `/intervista` (quiz statico, scoring client-side, cattura solo il lead) + `/intervista/risultati` — vedi punto 6, NON è collegato a Odoo/Kairós in alcun modo.

## 4. KNOWLEDGE BASE

- Modelli reali installati: `erpv6.kb`, `erpv6.kb.category`, `erpv6.kb.request`, `erpv6.kb.validation.gate`, `erpv6.kb.engine`, `erpv6.kb.normalizer`, `erpv6.kb.usage`, `erpv6.kb.tag`, `erpv6.kb.import.wizard` (+ righe), `erpv6.kb.extraction.service`, più `biz.knowledge.gap` e `knowledge.extraction`.
- Soglie DSCR/leva finanziaria **come regola strutturata**: **NON TROVATE** — nessuna riga in tutto `odoo-modules/` (codice o XML) definisce queste soglie, e nessun `erpv6.kb`/`erpv6.kb.category` ha un nome che le referenzia esplicitamente. Il contenuto KB è cifrato a riposo, quindi non è escluso che esista come *dato* cifrato non ispezionabile via grep — ma nessuna categoria/struttura dati dedicata a soglie DSCR/leva esiste a livello di schema.
- **Nota rilevante**: un documento Typst generato manualmente (vedi punto 5) contiene DSCR=1.35x/soglia 1.2x e leva=62%/soglia 60% dentro `render_data.diagnosi.metriche` — ma è dentro un payload di test scritto a mano, non prodotto da un motore che legge soglie KB reali.

## 5. COLLEGAMENTO MANCANTE (generazione PDF finale)

- **`generate_document` esiste** ed è generico: `erpv6.typst.engine.generate_document(template_id, res_model, res_id, data)`, chiamato da `production_order.py` sia per l'output di fase (`_generate_phase_output`, via `_build_typst_data()`) sia per NDA/Contratto (`_generate_contract_document_pdf`).
- **`_build_typst_data()` (l'UNICO builder di render_data automatico che esiste) restituisce solo 5 campi generici**: `lead_name`, `email_from`, `interview_score`, `interview_package_hint`, `verticale`. **Non costruisce MAI** i campi richiesti dal template WW-STD-001 (`criticita`, `azioni_urgenti`, `schede`, `diagnosi`, `roadmap`, `sintesi`, `raccomandazione`, `preview`).
- **Ho cercato in tutto il codice Python chi costruisce un dizionario con chiavi `criticita`/`azioni_urgenti`: zero risultati.** Il render_data ricco effettivamente usato nei documenti "ready" (es. id 695) esiste SOLO come dato scritto a mano (uno script/test manuale via shell Odoo), non generato da nessun metodo applicativo.
- **Conclusione**: il collegamento "intervista → matrice Kairós → render_data WW-STD-001" **non esiste in nessuna forma automatica**. Il template è pronto e testato manualmente con successo, ma nessun codice collega i dati reali (interview_answer, kairos_matrix, KB) al payload che il template si aspetta.

## 6. VISTA BLUR (teaser pre-pagamento)

- **Il meccanismo di blur reale ed effettivamente funzionante non è una pagina web — è dentro il PDF Typst stesso**: il main template (`typst_source` di WW-STD-001) legge `data.preview` (`#let blurred = data.at("preview", default: false)`) e, se `true`, sfoca (`barre-blur`) SOLO: la sintesi, le "schede azione" (opportunità, via `50_scheda_azione.typ`, parametro `blurred:`), la roadmap e la raccomandazione finale. **Criticità e azioni urgenti (`40_criticita.typ`, usato per entrambe) non vengono MAI sfocate, in nessun ramo del codice** — verificato leggendo il sorgente `.typ` riga per riga: nessun `if blurred` le avvolge. Verificato anche che questo meccanismo **funziona davvero** (documento id 695, `preview: true`, `status: 'ready'`, PDF reale generato senza errori).
- **Separazione dati**: SÌ, a livello di schema — `criticita`, `azioni_urgenti` e `schede` (opportunità) sono tre liste JSON distinte nel render_data, non un blob unico con blur CSS generico. Struttura corretta secondo il criterio richiesto.
- **Però questo render_data esiste solo come test manuale** (punto 5) — non è collegato a nessuna pipeline reale, quindi questa corretta separazione "non sfoca mai una criticità" oggi è vera solo perché qualcuno l'ha scritta a mano così, non perché un motore garantisca strutturalmente questa proprietà per ogni nuovo caso.
- **Una "vista blur" lato WEB (Next.js) esiste come componente**: `components/shared/BlurLock.tsx`, il cui commento dichiara esplicitamente lo stesso principio ("blur SOLO per le opportunità, VIETATO su criticità e azioni_urgenti"). **Ma questo componente non è importato/usato da NESSUNA pagina in tutto il repo** — è codice morto. Contiene anche `// TODO(payment): collegare al Payment Link Stripe reale`.
- **La pagina che sembrerebbe questa vista** (`/intervista/risultati`) è invece **completamente scollegata**: legge dati da `sessionStorage`, con TUTTI i contenuti hardcoded/demo ("Fatturato in crescita del 15% annuo", ecc.), nessun blur, nessuna chiamata a backend, nessuna relazione con Kairós/KB/validazione. Appartiene al percorso `/intervista` (quiz statico legacy), non al percorso reale `/intervista/guidata` collegato a Odoo.
- **Gate `erpv6.validation`**: il modulo `erpv6_validation` esiste (`erpv6.validation.session/.round/.analysis`), ed è usato realmente da `erpv6_production` (es. `_build_typst_data()` è esplicitamente riusato come `context_data` di una validation.session, `production_order.py:434`). Ma poiché **non esiste alcun payload Win-Win reale generato da codice** (punto 5), oggi nessun contenuto Win-Win passa mai per questo gate — passa solo il payload generico a 5 campi.
- **Pagamento → sblocco**: **non implementato, nemmeno parzialmente in senso reale**. `/checkout/[id]` e `/api/payments/[id]/route.ts` sono un **mock completo**: dati letti/scritti su un file JSON locale del server Next.js (`src/data/invoices.json`, con un invoice demo hardcoded), il "pagamento" è un `setTimeout(2000ms)` che poi marca `status:'paid'` — **nessuna chiamata Stripe, nessun webhook, nessun token univoco per link email**.
- **Report post-sblocco = stesso contenuto validato o rigenerato?** Domanda non applicabile allo stato attuale: non esistendo né una pipeline di generazione automatica né un pagamento reale, non c'è nulla che si "sblocca" oggi — il PDF con `preview:false` andrebbe generato con lo stesso render_data del preview (stesso meccanismo `blurred` a `false`), quindi **l'architettura del template supporta correttamente lo sblocco istantaneo** (stesso documento, solo flag diverso) — ma nessun codice orchestratore lo fa accadere.

---

## RIEPILOGO GAP

**Il PDF Typst finale (punti 1-5) e la "vista blur" (punto 6) sono molto più indietro di quanto un lettore della sola documentazione penserebbe — ma il pezzo più rischioso (separazione criticità/opportunità) è in realtà l'unico già risolto correttamente, dentro il PDF.**

- ✅ **Funziona davvero**: motore intervista ad albero (Odoo↔Next.js reale), calcolo Kairós (matrice reale, regole in dato non in codice), template Typst WW-STD-001 con meccanismo di blur selettivo corretto (mai su criticità/azioni urgenti) — testato con successo su un caso manuale.
- ❌ **Manca completamente**: il codice che costruisce il render_data ricco (criticità/azioni urgenti/schede/diagnosi) a partire da intervista+Kairós+KB reali — oggi esiste solo come payload scritto a mano una volta per collaudare il template. Questo è IL gap singolo più importante: senza questo pezzo, nessuno dei due deliverable (PDF finale via email, vista pre-pagamento) può partire da un caso reale.
- ❌ **Vista blur pre-pagamento lato web**: non esiste in forma funzionante. Il componente che rispetta il principio di sicurezza (`BlurLock.tsx`) è codice morto, mai collegato a nessuna pagina. La pagina che sembra ricoprire questo ruolo (`/intervista/risultati`) appartiene a un flusso legacy scollegato, con dati completamente finti.
- ❌ **Pagamento**: mock totale su file JSON locale, zero integrazione Stripe reale, zero token/link sicuro.
- ⚠️ **Bug minore non bloccante**: `page_count` mai calcolato sui typst.document generati con successo.

Il flusso completo richiesto (intervista → matrice Kairós → render_data → PDF finale via email E vista blur pre-pagamento) **non esiste end-to-end in nessun punto**: il segmento "render_data reale" è il collo di bottiglia che blocca sia il PDF finale sia la vista pre-pagamento — non è che uno dei due deliverable sia avanti e l'altro indietro, sono entrambi fermi allo stesso punto a monte (nessun ponte automatico tra dati reali e template), con la sola eccezione che il *meccanismo* di blur nel PDF è già pronto e corretto, mentre il suo equivalente lato web è codice morto/mai iniziato.
