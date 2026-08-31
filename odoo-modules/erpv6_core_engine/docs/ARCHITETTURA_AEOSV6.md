# Adaptive EOSv6 (Kaizen-Lean) — Manuale di architettura

Documento vivo, non una specifica chiusa. Scritto il 29/08/2026 dopo il pilota sul circuito
6 Giudici e quattro decomposizioni reali (`erpv6_color`, `erpv6_contract`/`erpv6_sign`,
`erpv6_tracking`, `erpv6_library`). Aggiornalo ogni volta che un caso nuovo rompe o
conferma un principio qui scritto — non lasciarlo indietro rispetto al codice.

Serve per tre usi diversi:
1. **Decomporre** un modulo esistente in dichiarazioni EAOSv6.
2. **Comporre** un modulo nuovo scrivendolo direttamente nel sistema nuovo.
3. **Usare il visual** (`/admin/circuit`) sia per leggere un circuito sia per costruirne
   uno nuovo da schermo — sezione ancora da scrivere, in coda.

## 1. L'idea di fondo

Il grafo deve **guidare l'esecuzione reale**, non documentarla. Se disattivi un arco, cambia
davvero quanti analisti girano in una sessione vera. Se un nodo non ha l'input che gli
serve, blocca con un errore chiaro — non inventa un default e finge di aver funzionato.
Ogni pezzo di questo documento discende da questa unica regola.

## 2. Le quattro primitive originarie

- **Nodo** = motore atomico.
- **Circuito** = nodo composito (`is_composite=True`), contiene altri nodi via
  `parent_id`/`child_ids`. Nessun modello separato: Circuito e Nodo sono la stessa cosa.
- **Arco** = collega due nodi, `action_type` (data_flow/trigger/gate_check/pid_fallback/
  retry_loop) decide forma/colore, `is_and_join` decide se il target scatta solo quando
  TUTTI gli archi AND in ingresso sono soddisfatti.
- **Fase** = contenitore temporale (Stage-Gate), raggruppa nodi (`node_ids`) e dichiara le
  sue entrate/uscite (`entry_gate_ids`/`exit_gate_ids`, M2m — lo stesso nodo può essere
  uscita di una Fase ed entrata della successiva).

Circuito e Fase sono **assi ortogonali**, non uno dentro l'altro: il Circuito è
contenimento/esecuzione (chi gira dentro chi), la Fase è raggruppamento temporale
trasversale che può tagliare un Circuito in fette diverse. Non forzare un vincolo 1:1 tra i
due — punto lasciato deliberatamente aperto, verificare se emerge un caso reale che lo
richiede prima di vincolarli.

## 3. Le cinque dichiarazioni di un Motore

Quando decomponi o scrivi un modulo, ogni comportamento reale si classifica su questi
cinque assi. Non tutti i nodi hanno bisogno di tutti e cinque — un circuito senza Gate né
Cron è normale, non incompleto.

### 3.1 Motore (`process_key`, elenco chiuso `SAFE_PROCESSES` in `core_node.py`)

Tre famiglie, mai testo libero:

- **IPO** — esegue codice deterministico diretto, nessun intermediario esterno.
  Esempi reali: `generate_phase_document` (Typst), `kb_engine_process` (motore KB
  generico), `create_tracking_lot` (crea un lotto di tracciamento).
- **AIPO** — deve passare dal "relè" `erpv6_omni_bridge` per funzionare. Esempio:
  `ai_analyze`.
- **ESTERNO** — chiama un servizio terzo con effetti reali fuori dal sistema (invia
  un'email vera, crea un record su un sistema esterno). Esempio: `send_to_documenso`.
  Due differenze strutturali dalle altre due famiglie:
  1. **Completamento spesso asincrono**: la chiamata che "esegue" il Motore non produce
     il risultato finale — l'invio è l'inizio, il completamento vero arriva dopo (webhook
     o poll). Stato dedicato `in_attesa_esterna` su `erpv6.core.node.execution`, diverso
     da `done`. Il modulo che riceve il webhook va esteso (`_inherit`) per chiudere
     l'esecuzione quando arriva davvero il completamento — vedi `sign_request_ext.py`.
  2. **Effetto irreversibile verso terzi**: non testare mai dal vivo senza un indirizzo/
     destinatario di test esplicitamente confermato dall'utente. Il rischio non è sui
     dati (come per IPO/AIPO), è sull'azione stessa.

Principio guida per non duplicare Motori: prima di scriverne uno nuovo, verifica se uno
già registrato in `SAFE_PROCESSES` copre già la stessa forma di operazione. Un modulo
nuovo che parla di "forme" invece che di "colori" userebbe lo stesso `kb_engine_process`,
cambiando solo la dichiarazione KB — zero Motore nuovo.

Regola di rigore per ogni Motore, non negoziabile: **niente default impliciti**. Se un
input obbligatorio manca, errore esplicito con l'elenco di cosa manca (vedi
`KB_ENGINE_REQUIRED_INPUTS`), mai un valore inventato. E se un Motore per principio
trasforma un'entrata in qualcosa di diverso, un percorso che restituisce l'entrata grezza
non elaborata (perché manca un traduttore dedicato per quel caso) è un **errore**, non un
successo parziale — vedi `KB_ENGINE_SPECIALIZED_TYPES`.

### 3.2 KB (rombo — vero rombo nel disegno, `erpv6.core.kb_link`)

Conoscenza/prompt/dati pre-esistenti, risolti da `erpv6.kb`:
- `resolution_mode='fixed_kb'` — pin diretto a una voce specifica.
- `resolution_mode='dynamic'` — risoluzione via `erpv6.kb.find_best_for(kb_type,
  verticale, category_hint)`, filtra `is_active=True`, preferisce match di verticale.

`data_format` (text/json/prompt) dichiarato sul rombo, non sull'arco — l'arco non porta un
terzo canale visivo per il formato dato.

### 3.3 Output / Output-Link (rettangolo rosso "a documento", base più stretta
dell'altezza — `erpv6.core.output` / `erpv6.core.output_link`)

Un Output è un artefatto **prodotto da un nodo a runtime** (non pre-esistente come una
KB), referenziabile come input **da qualunque altro nodo, non necessariamente in
sequenza diretta** — "l'output intervista è input di metodologia, ma non per forza sono
sequenziali". Tipi: documento/tabella/testo/json — la Tabella non è una forma a sé, è un
`output_type` come gli altri (stesso principio di `data_format` sulla KB).

`resolve_value()` ritorna l'`output_data` dell'ultima esecuzione **riuscita** del nodo
produttore — mai un fallback silenzioso, se il nodo non ha mai girato con successo
ritorna `False`.

`run_process()` risolve automaticamente `output_link_ids` in `input_data['linked_outputs']`
prima di chiamare il Motore — indipendente da qualunque arco.

**Aperto, non ancora costruito**: l'idea di "arricchire" un Output già esistente (es. un
codice lotto che si lega indelebilmente a un documento già prodotto) invece di crearne uno
nuovo — emerso durante la decomposizione di `erpv6_tracking`, non ancora modellato.

**Regola fondamentale, non negoziabile** (Denis, 29/08/2026): *"tutti i circuiti devono
dire che tipo di output generano e l'informazione deve viaggiare sempre"*. Concretamente:
`library_category_name` è `required=True` su ogni Output — un circuito non può dichiarare
un Output senza etichettarlo, né a livello di modello né già nel controller.

#### 3.3.1 Etichettatrice + Traslo (`erpv6.core.library_category`, Motori `label_output` / `file_to_library`)

Pattern nato dalla decomposizione di `erpv6_library`, con un'immagine guida: "vedo un
traslo e un'etichettatrice". Due Motori IPO separati, riusabili indipendentemente:

- **Etichettatrice** (`label_output`) — legge/conferma la categoria già risolta su un
  Output. Non cerca/crea più nulla lei stessa (vedi sotto): il suo ruolo è confermare, non
  decidere.
- **Traslo** (`file_to_library`) — avvolge `erpv6.library.document.register_document()`
  (punto di ingresso canonico già esistente, che alcuni percorsi in `erpv6_api_gateway`/
  `erpv6_marketing` bypassano ancora con `.create()` dirette). Risolve `category` da un
  Output collegato se non passata esplicita.

**`erpv6.core.library_category` è additivo, mai un sostituto**: `erpv6.library.document.
category` (Selection chiusa, letta come stringa in 4 moduli diversi — `erpv6_agent`/
`marketing`/`production`/`kaizen`) resta identica, intoccata. `category_id` (nuovo campo,
via `library_document_ext.py`) è il catalogo vero parallelo. Mappatura tra i due: se
l'etichetta dichiarata coincide esattamente con uno dei 13 valori legacy va diretta,
altrimenti `'other'` sul campo legacy (che resta `required=True`) — **attenzione al
confronto a stringa esatta**: `"business plan"` (spazio) e `"business_plan"` (underscore)
non sono la stessa cosa per questo confronto, verificato con un test reale che è caduto
in questo caso.

**La categoria si risolve alla DICHIARAZIONE, non all'esecuzione**: `erpv6.core.output.
create()` fa trova-o-crea la categoria nel momento stesso in cui l'Output viene
dichiarato — sia da un data XML all'installazione di un modulo circuito, sia da API. Non
serve eseguire nulla perché il catalogo si popoli. Quando la categoria è genuinamente
**nuova** (mai vista prima, non solo trovata), parte un segnale Heinrich reale e visibile
(`erpv6.heinrich.indicator.log_signal`, severità `near_miss`) — "quando EAOSv6 legge che
la categoria è nuova, attiva l'etichettatrice che etichetta lo scaffale": non un'esecuzione
di nodo sintetica (nessun nodo reale la possiede necessariamente), ma un evento tracciabile
vero, stesso meccanismo già usato dai cron di lettura.

### 3.4 Gate (bordo oro spesso sul rettangolo, `phase_gate_type` sul Nodo)

**Correzione architetturale importante**: il Gate NON è un `circuit_role` del nodo (era
così all'inizio, sbagliato). È una proprietà indipendente da `is_composite`/`circuit_role`
— qualunque nodo, atomico o composito, può essere il Gate della Fase che lo contiene.

`phase_gate_type`: `'umano'` (conferma manuale, richiede nessun Motore) o `'ai'` (arbitro,
richiede un Motore AIPO — ma NON necessariamente `process_key='ai_analyze'`: il Sesto
Uomo reale dei 6 Giudici passa da `erpv6_validation._run_round`, wrapping reale, non da
`SAFE_PROCESSES`). Vincoli reali: **al massimo un Gate per Fase** (verificato sia lato
Fase sia lato Nodo — un bug trovato in test: il vincolo lato Fase non scattava se il flag
veniva attivato dal nodo direttamente, corretto con un secondo `@api.constrains`
simmetrico).

### 3.5 Cron / PID (`cron_role`, ir.cron reale collegato via `create_cron_node`)

Un PID è "attivazione di un circuito assestante e parallelo generico" — rappresentato da
un nodo `circuit_role='pid'`, sempre `is_composite=True`, con un vero `ir.cron` collegato
(mai un box decorativo). `cron_role`:
- `'lettura'` — sensore, registra solo un segnale (`erpv6.heinrich.indicator.log_signal`),
  mai scrive altrove.
- `'attivazione'` — invoca un trigger dell'elenco chiuso `SAFE_ACTIVATION_TRIGGERS`, mai un
  metodo arbitrario passato da un form.

Creato sempre `active=False` — va attivato esplicitamente con `action_activate_cron()`
("quando usciamo dalla prova e mettiamo online correttamente diventano cron veri").

## 4. Output Binding (`erpv6.core.node`, campi `output_binding_*`)

Il pezzo che rende una migrazione una **vera sostituzione**, non solo un avvolgimento
parallelo. Senza questo, il risultato di un Motore finisce solo nel log
(`erpv6.core.node.execution.output_data`) — mai scritto sul campo di un record reale come
faceva il codice originale (`self.write({'selected_palette': palette})` in
`erpv6_color`).

Dichiarato sul nodo (statico — questo Motore scrive sempre nello stesso modello/campo):
`output_binding_model`, `output_binding_field`, `output_binding_record_key` (quale chiave
di `input_data` contiene l'id del record — mai indovinata), `output_binding_value_path`
(percorso punteggiato dentro l'output, es. `'result.palette'` — vuoto = scrive l'intero
output). Risolto in `run_process()` dopo un completamento **sincrono** (`status='done'`):
un Motore Esterno asincrono si legherebbe al completamento vero (webhook), non a questo
meccanismo — non ancora costruito.

Mai un fallback silenzioso: record mancante, `record_key` non fornito, o percorso valore
inesistente sono errori espliciti che marcano l'esecuzione `failed`, mai un campo lasciato
vuoto senza avviso.

## 5. La regola dell'orchestratore

Regola strutturale, vale sia per la decomposizione di moduli vecchi sia per la scrittura
di moduli nuovi da zero:

> Quando un Motore dichiara di aver bisogno di un dato, EAOSv6 (come orchestratore, stesso
> ruolo che il CLAUDE.md assegna a `erpv6_opportunity` tra `erpv6_kaizen` e `erpv6_bandi`)
> prima cerca se esiste già una fonte reale canonica nel sistema e ci si collega; solo se
> non esiste da nessuna parte, la crea centralmente lui. Mai un modulo verticale che
> duplica localmente un dato che dovrebbe essere centrale.

Caso reale che ha originato la regola: `erpv6.tracking.config.company_code`/
`default_brand` erano testo libero digitato a mano, scollegato da qualunque fonte reale.
Verificato: `res.company` non aveva nessun codice breve (aggiunto da
`erpv6_core_engine/models/res_company_ext.py` — l'orchestratore lo crea perché non
esisteva altrove); per "brand" invece esistevano **due** fonti reali già esistenti e
scollegate tra loro (`erpv6.whitelabel.config.code`, legato a `res.company` ma pensato
come identificativo di dominio/brand whitelabel; `erpv6.consulting.brand.code`, un
concetto di business completamente diverso — tariffe di consulenza, non c'entra con la
tracciabilità) — questione ancora aperta, non risolta.

Prima di collegare un Motore a una fonte, chiediti sempre: esiste già altrove nel sistema
questo dato, o sto per duplicarlo? Un modulo che sembra avere bisogno di conoscenza nuova
spesso ha solo bisogno di un collegamento a conoscenza che già esiste altrove, scollegato
per disattenzione, non per necessità reale.

## 6. Metodo di decomposizione (checklist)

Per ogni modulo:

1. Leggi **tutto** il codice sorgente reale, mai fidarti di un `docs/ANALISI_STATO.md`
   preesistente senza riverificarlo — **in tutti e quattro i casi fatti finora, almeno un
   claim del doc esistente si è rivelato obsoleto** (nomi di metodi/controller cambiati,
   "codice morto" che in realtà veniva chiamato da un altro modulo, bug segnalati come
   presenti che in realtà erano già stati corretti a metà).
2. Per ogni metodo pubblico rilevante, classificalo sui 5 assi (§3). Non forzare una
   classificazione se un asse non si applica — un circuito senza Gate/Cron è normale.
3. Verifica le dipendenze dichiarate nel manifest contro l'uso reale nel codice (grep
   incrociato). Cerca dipendenze implicite non dichiarate (funzionano solo per una catena
   transitiva fragile).
4. Cerca esplicitamente: firme di funzioni incoerenti con le chiamate reali; fallback
   silenziosi che scelgono un default sbagliato senza avviso; campi dichiarati ma mai letti
   (flag "morti", promettono un comportamento che il codice non implementa); regole di
   sicurezza mancanti; percorsi paralleli che bypassano il punto di ingresso principale.
5. Segnala esplicitamente ogni caso di "dato duplicato che dovrebbe essere centrale"
   (§5) — non risolverlo senza confermare con l'utente dove dovrebbe vivere davvero.
6. Prima di ogni chiamata dal vivo per verificare un Motore: usa sempre materiale di test
   dedicato (mai un record/cliente reale), tranne quando il meccanismo stesso da provare
   richiede dati attivi (es. risoluzione dinamica KB con `is_active=True` — deroga
   esplicita e documentata, mai silenziosa) o quando l'azione ha effetti reali verso terzi
   (Motore Esterno — mai senza conferma esplicita del destinatario di test).
7. Ripulisci sempre gli artefatti di test (nodi, archi, output, esecuzioni, record)
   subito dopo la verifica — mai lasciarli a sporcare i dati reali.

Track record finora: **8 bug reali trovati e corretti** su tre moduli completamente
decomposti (`erpv6_color`, `erpv6_contract`/`erpv6_sign`, `erpv6_tracking`), più diversi
altri trovati (non ancora corretti) in `erpv6_library`. La decomposizione funziona anche
come audit, non solo come modellazione — va budgetato come tale.

## 7. Comporre un modulo nuovo da zero

Stessa logica del §6, ma senza codice esistente da decomporre: dichiara i nodi con le
cinque proprietà (§3), verifica per ogni dato di cui il Motore ha bisogno se esiste già
una fonte reale nel sistema (§5) prima di inventare un campo nuovo, e usa sempre
`SAFE_PROCESSES` esistenti quando la forma dell'operazione è già coperta (§3.1).

## 8. Stato reale del sistema (non nascondere i debiti)

**Cosa regge, verificato dal vivo, non solo scritto**:
- Esecuzione ricorsiva multi-circuito (`run_circuit()` su un nodo radice che contiene
  altri Circuiti, trova ed esegue i Motori annidati in profondità).
- Sequenza reale tra nodi di Circuiti diversi (arco cross-circuito rispettato
  nell'ordine di esecuzione — un nodo con un arco in ingresso riceve SIA l'input
  esplicito SIA il contesto a monte, bug reale trovato e corretto proprio testando questo).
- Output Binding end-to-end (scrittura reale su un campo di un record esterno, non solo
  nel log di esecuzione).
- Etichettatrice + Traslo (`label_output`/`file_to_library`), catalogo categoria
  popolato alla dichiarazione dell'Output, segnale Heinrich su categoria nuova.
- Le 9+ correzioni di bug elencate al §6.

**Cosa NON è ancora vero, da non promettere per sbaglio**:
- **PID che attiva un intero Circuito**: oggi un PID (cron) attiva un **metodo
  specifico** whitelisted (`SAFE_ACTIVATION_TRIGGERS`), non `run_circuit()` di un altro
  Circuito. "I circuiti si attivano a vicenda" è vero nel senso di Output-Link/archi
  cross-circuito (un Motore alimenta un Motore altrove), non ancora nel senso di un PID
  che lancia l'esecuzione completa di un altro Circuito — pezzo non ancora costruito.
- **Alleggerimento dei moduli**: ancora marginale. Nessun modulo esistente è stato
  smontato per davvero — i bottoni/azioni originali di `erpv6_color`/`erpv6_sign`
  chiamano ancora il codice vecchio. L'unico caso dove la decomposizione ha corretto
  la fonte condivisa (non solo avvolto) è `erpv6_tracking` (`tracking_lot.py` ora legge
  `res.company` per davvero).
- **Layout multi-circuito nel visual**: espandere due Circuiti diversi contemporaneamente
  sullo stesso foglio produce sovrapposizione illeggibile — mai verificato/corretto
  (nessun accesso browser in questa sessione), registrato come debito serio.
- **Motore Esterno mai testato dal vivo**: `send_to_documenso` costruito e verificato solo
  a livello di struttura/compilazione, mai chiamato realmente contro Documenso — in attesa
  di un indirizzo di test esplicitamente confermato.
- **`res.company.company_code` non popolato**: il campo esiste ma è vuoto ovunque tranne
  V6 Impresa (`'V6I'`, riportato da un dato reale preesistente). Qualunque Motore di
  tracciamento fallirà finché non viene compilato per l'azienda coinvolta — comportamento
  corretto (errore esplicito), ma va saputo prima di lanciare un flusso reale.
- **Brand duplicato, non risolto** (§5): whitelabel vs consulting brand, nessuna
  decisione presa.

## 9. Glossario rapido

- **Circuito** = Nodo composito. **Fase** ≠ Circuito, asse ortogonale.
- **IPO** = deterministico diretto. **AIPO** = via relè AI (`erpv6_omni_bridge`).
  **ESTERNO** = servizio terzo, spesso asincrono, effetto reale irreversibile.
- **Rombo** = KB (conoscenza pre-esistente). **Rettangolo rosso stretto** = Output
  (artefatto prodotto a runtime).
- **Bordo oro spesso** = Gate (qualunque nodo, umano o AI, autorità di una Fase).
- **PID** = Circuito con vero cron collegato, sempre `active=False` alla creazione.

## 10. Sezione aperta — uso del Visual (`/admin/circuit`)

Da scrivere insieme: lettura di un circuito esistente (rombi, output, gate, espandi/
collassa) e creazione di uno nuovo direttamente da schermo (form Nuovo Nodo, Nuova Fase,
collegamento archi/KB/Output). Include il debito noto del layout multi-circuito (§8).
