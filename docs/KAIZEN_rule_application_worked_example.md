# Kaizen — esempio guidato di applicazione completa delle 12 Regole

Documento di riferimento, non solo per il caso specifico trattato qui, ma come
**esempio da seguire quando si costruisce per davvero il codice del sensore
Kaizen "copertura grafo"** (vedi `docs/PLAN_knowledge_graph_phase1.md`,
backlog, e la memoria di sessione `project_knowledge_graph_session_20260822.md`).

Serve anche come prima voce di "esperienza pregressa" reale per l'Indicatore 5
della Regola 11 (Kairós) su casi futuri simili — è esattamente il tipo di
memoria che la Regola 9 ("standardizzare i miglioramenti") richiede di
produrre come documento vero, non solo un campo di stato nel DB.

## Requisito architetturale che questo esempio dimostra

Applicando le regole in sequenza in conversazione, un'analisi già fatta (il
risultato della Regola 1) è stata **persa** prima di arrivare alla sintesi
finale, e recuperata solo perché l'utente se n'è accorto. Questo dimostra dal
vivo perché **Kaizen non può tenere il ragionamento "in memoria di
conversazione"**: ogni regola applicata a un segnale deve scrivere la propria
risposta in una **tabella temporanea legata a quel segnale** (una riga per
`numero_regola` + `risposta` + `dati_a_supporto`), e la Regola 11 (scoring)
deve **rileggere tutte le righe precedenti**, mai fidarsi del contesto
conversazionale/implicito. Requisito non negoziabile per l'implementazione
reale, non un dettaglio stilistico.

## Il caso di partenza

Segnale ipotetico che il sensore "copertura grafo" (mai ancora costruito,
solo progettato) avrebbe potuto trovare: `erpv6.typst.template` ha contenuto
reale (11 record, 7 con `typst_source` vuoto — verificato live più volte,
non stimato) mai rappresentato nel vocabolario del Knowledge Graph
(`docs/PLAN_knowledge_graph_phase1.md`, verificato via grep: zero menzioni).

## Applicazione delle 12 regole, in ordine

**0. Principio guida** — il segnale si aggancia a un record reale
(`erpv6.typst.template`), mai a una UI separata.

**1. Ogni problema è un'opportunità** — **trovato un secondo segnale, più
grande del primo**: verificato via grep reale su tutto `erpv6_kaizen` che
**non esiste in nessuna pagina del sistema un bottone contestuale
(`binding_model_id`/`binding_view_types`) per segnalare qualcosa a Kaizen** —
solo un menu standalone ("Segnalazione Manuale"), zero precompilamento dal
contesto. Questo secondo segnale è risultato **più importante** del primo
dopo il ripunteggio (vedi sotto) — non un dettaglio del caso template.

**2. Lavorare sul metodo, non le persone** — la causa non è "chi ha
costruito erpv6_typst si è dimenticato" — è l'assenza di un passo di
processo che controlli, alla creazione di un nuovo modello, se merita
rappresentazione nel grafo. Il ticket punta al processo mancante, non a una
persona.

**3. Uno stile di vita** — il controllo deve essere un `ir.cron` ricorrente
vero (stesso stile di `_cron_retry_kb_extraction_failures`), cadenza
probabile settimanale (non ogni 30 min come il sensore operativo — è una
chiamata AI, costa). Verificato che sia un miglioramento reale: oggi questi
buchi si trovano solo con revisione manuale (3 volte in una sera), un cron
riduce il tempo in cui restano invisibili — con un costo reale (chiamate AI)
da pesare, non gratuito.

**4. Dati e fatti, non opinioni** — **errore fatto e corretto qui stesso**:
la prima volta i numeri (11/7) sono stati riusati da un report precedente
nella conversazione senza riverifica al momento dell'applicazione della
regola — non soddisfa la regola. Riverificato live (`SELECT count(*)...
FROM erpv6_typst_template`): confermati 11/7. **Principio derivato**: Kaizen
deve rieseguire la verifica ogni volta che applica questa regola, mai
fidarsi di un numero riportato da un'altra fonte/agente/turno precedente,
anche se corretto.

**5. Non accettare lo status quo** — due cose non vanno considerate fisse
per sempre: (a) la lista chiusa di modelli che il sensore controlla (va
rivista periodicamente, non decisa una volta), (b) un segnale marcato
"valida" non è chiuso per sempre — va ricontrollato più avanti con lo
stesso meccanismo a contatore dei cron di retry esistenti.

**6. Cause profonde (5 Why)** — richiede un modello dedicato mai costruito,
`erpv6.kaizen.five_why` (la nota originale lo rimandava a "quando/se si
costruisce erpv6_kaizen" — condizione ora soddisfatta, costruibile per
davvero). Catena applicata al caso:
1. Perché i template non sono nel grafo? → Nessuno li ha aggiunti.
2. Perché? → Non esiste un controllo di processo per nuovi modelli.
3. Perché? → Il progetto Knowledge Graph non esisteva quando erpv6_typst è
   stato costruito.
4. Perché non è stato aggiunto retroattivamente? → Il progetto KG ha poche
   ore di vita.
5. Perché il controllo era manuale finora? → **Perché il processo stesso
   non esisteva fino a questa conversazione** — non è una causa esterna da
   aggirare, è ciò che si sta costruendo per risolverla.

**7. Coinvolgere tutti** — nessuna evidenza di un team distinto da Denis
oggi; il meccanismo di notifica va comunque costruito generico
(`partner_ids` plurale), non hardcodato su un solo destinatario, per
funzionare da solo se in futuro ci sarà un secondo responsabile.

**8. Creatività a basso costo** — punteggio Pareto (vedi sotto) non
abbastanza alto da giustificare una corsia rapida — resta sul flusso
normale di conferma via Sabrina. Eccezione CCP/fiscale controllata
esplicitamente: non si applica a questo caso (è un cambiamento strutturale
di schema, non contenuto CCP/fiscale).

**9. Standardizzare** — **questo stesso documento è l'applicazione della
regola**: un miglioramento (il ragionamento strutturato applicato qui) va
reso standard/riusabile, non lasciato come conversazione isolata. Una volta
che il sensore reale esisterà, ogni segnale "diventato valida" dovrebbe
generare un documento analogo (via `erpv6.typst.engine`, stesso pattern del
certificato 6 Giudici), non solo un flag di stato nel DB.

**10. Eliminare gli sprechi (Muda)** — rischio identificato: rifare la
chiamata AI su ogni modello della lista ad ogni giro anche se nulla è
cambiato è spreco puro (*Sovrapproduzione*/*Processi*). Il controllo va
fatto solo se qualcosa è davvero cambiato dall'ultimo giro (es. conteggio
record cresciuto) da quel modello specifico.

**11. Rubrica di scoring** — fatta **due volte**: la prima (sbagliata,
prematura, fatta prima di "arrivarci" nell'ordine e senza il recupero della
Regola 1) e la seconda (corretta, dopo il recupero). Solo la seconda è
valida — la prima è lasciata qui sotto proprio per mostrare quanto i numeri
cambiano quando manca un pezzo di contesto.

### Punteggio finale — due segnali distinti, non uno

**Segnale A (principale) — assenza di un canale contestuale di segnalazione
a Kaizen su qualunque pagina** (trovato con la Regola 1, non il segnale di
partenza):
- Pareto: `frequenza=5` (riguarda ogni pagina del sistema, non un caso
  isolato), `impatto=3` (esiste un aggiramento — il menu standalone — ma
  scomodo)
- Kairós tecnico: `impatto_score=3`; indicatori: causa chiara=3, rischio
  fix=3 (additivo, aggiungere binding_model_id a azioni esistenti), 
  dipendenze esterne=3 (nessuna), urgenza/impatto in atto=**2** (non
  latente — ha già causato un costo reale: ore di lavoro manuale stanotte
  per trovare a mano 3 buchi), esperienza pregressa=**dichiarata mancante
  esplicitamente** (Regola 4 lo permette: dato non disponibile, non va
  stimato)
- Heinrich: **lieve** (non near_miss — ha già causato una perdita di tempo
  reale, nessun dato perso)

**Segnale B (figlio, minore) — `erpv6.typst.template` non rappresentato nel
vocabolario grafo**:
- Pareto: `frequenza=3`, `impatto=2`
- Kairós tecnico: `impatto_score=2`; indicatori: 3, 3, 3, 1 (qui sì
  genuinamente latente, non ha ancora causato nulla), esperienza
  pregressa=dichiarata mancante
- Heinrich: **near_miss**

### Prima versione, sbagliata (lasciata per confronto, MAI da riusare)

Pareto frequenza=3/impatto=2, Kairós [3,3,3,1,3], Heinrich near_miss — fatta
sul solo Segnale B, prima di recuperare il Segnale A. Il confronto con la
versione corretta sopra è la prova diretta del perché serve la tabella
temporanea per-regola invece del ragionamento a memoria.

## Cosa resta da costruire (non fatto qui, solo progettato)

- Tabella temporanea reale per le risposte regola-per-regola di Kaizen
  (requisito architetturale sopra).
- `erpv6.kaizen.five_why` (Regola 6), mai costruito.
- Bottone contestuale di segnalazione (`binding_model_id`) sulle pagine
  rilevanti — il Segnale A stesso, non ancora risolto, solo trovato e
  scorato.
- Il sensore "copertura grafo" vero e proprio (cron + chiamata AI su lista
  chiusa di modelli, con controllo "è cambiato qualcosa" per evitare lo
  spreco della Regola 10).
- Collegamento del ciclo completo Kaizen → Sabrina → conferma → poll →
  "in rodaggio" → "valida" → documento di standardizzazione (Regola 9).
