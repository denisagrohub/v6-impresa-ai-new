# PLAN — Knowledge Graph erpv6, Fase 1 (1A + 1B + 1C.1 consolidati)

Stato: schema consolidato e approvato dall'utente in più round di revisione.
**Nessuna estrazione reale di triple eseguita.** Nessuna scrittura sulla pipeline
KB, nessun backfill, nessun servizio Neo4j creato. Tutto quanto sotto è
proposta di schema + dati reali già estratti in sola lettura (Fase 1A).

Vincoli permanenti confermati più volte durante questo lavoro (vedi anche
`docs/ANALYSIS_knowledge_graph.md` per la Fase 0): mai `fattorie_della_fenice`,
mai scrittura su `erpv6` fuori da questo script di estrazione, solo branch
dedicato, nessun nuovo container Docker senza conferma esplicita.

---

## 1A — Grafo ORM del codice (reale, già estratto)

Script: `erpv6_devtools/graph/extract_orm_graph.py`, eseguito via `odoo shell`
sul DB `erpv6` (staging, mai `fattorie_della_fenice` — confermato esplicitamente
in una revisione precedente). Output: `erpv6_devtools/graph/orm_graph_2026-08-21.json`.

Statistiche reali (dal file generato, non stimate):

| | conteggio |
|---|---|
| nodi modulo | 164 |
| nodi modello | 689 |
| **totale nodi** | **853** |
| archi `depends_on` (modulo→modulo) | 459 |
| archi `relates_to` (modello→modello, da campo relazionale ORM) | 4306 |
| **totale archi** | **4765** |

Struttura nodo reale (`kind: module`):
```json
{"id": "module:sale_management", "label": "sale_management", "kind": "module",
 "origin": "odoo_core", "status": "production", "installed_on_wrong_instance": false}
```

`origin` ∈ {`odoo_core`, `erpv6`, `fenice`}. `installed_on_wrong_instance` è
`true` solo per i moduli `fenice_*` (installati su questa istanza per errore/in
attesa di essere sistemati — non è codice morto, è un problema reale non
ancora risolto, in backlog qui sotto). Non esiste alcun nodo `planned` o
fabbricato: solo ciò che risulta realmente installato.

Struttura arco reale:
```json
{"source": "module:sale_management", "target": "module:sale", "type": "depends_on"}
```

## Le due viste filtrate (già generate, pronte)

**Vista (a) — solo moduli**: `erpv6_devtools/graph/orm_graph_view_modules.json`
164 nodi / 459 archi (identica al sottoinsieme moduli del grafo completo, nessun filtro aggiuntivo).

**Vista (b) — modelli non-`odoo_core`** (erpv6 + fenice) **+ nodi core referenziati da almeno un arco**:
`erpv6_devtools/graph/orm_graph_view_models_erpv6.json`. Due varianti, attivabili/disattivabili
lato client, nessuna delle due imposta come scelta definitiva qui:

| variante | nodi | archi |
|---|---|---|
| `default` (nessun filtro grado) | 114 | 478 |
| `hide_hub_threshold_50` (nasconde nodi core con grado totale >50, es. `res.users`/`res.partner`/`res.company`) | 101 | 121 |

La differenza reale tra le due varianti (478 → 121 archi) conferma che il filtro
funziona correttamente sui nodi core referenziati, non sui nodi erpv6/fenice
(che non sono mai hub) — bug di implementazione trovato e corretto in una
revisione precedente di questo stesso lavoro.

---

## 1B — Schema proposto per il grafo log/changelog

**Nodi**: `Errore`, `Modulo`, `Fix`. `VoceKB` (`erpv6.kb`) **non è un nodo
separato quando è di tipo `changelog_tecnico`** — viene assorbita nel nodo
`Fix` stesso (altrimenti si crea un nodo `VoceKB` e un nodo `Fix` che
descrivono la stessa cosa, collegati da un arco ridondante). `VoceKB` resta
un nodo a sé per tutti gli altri `kb_type` (vedi 1C.1).

Un "fix" applicato al codice **vive in due posti reali oggi**, non uno solo:
`erpv6.kb` (`kb_type='changelog_tecnico'`) E `erpv6.agent.proposal`
(`status='actioned'`) — corretto durante la revisione dopo che l'utente ha
fatto notare che il fix non vive solo fuori da Odoo. Una terza fonte,
**futura ed esterna** (git/GitHub, commit/PR), è un arricchimento eventuale,
**non una fonte già disponibile oggi** — non va presentata come tale.

**Nodo `Fix`**
- `fix_id`: identificatore composito **`"{source_model}:{record_id}"`**
  per ogni fonte (es. `"erpv6.kb:1042"`, `"erpv6.agent.proposal:88"`) — non
  uno schema fisso unico
- `sources: []` — lista di riferimenti a tutte le fonti reali note per lo
  stesso fix; se in futuro due fonti diverse risultano descrivere lo stesso
  fix reale, si aggiunge qui **solo dopo deduplicazione umana, mai automatica**
  (stesso principio "mai inventare" applicato all'identità dei nodi)
- `descrizione`
- `data`

**Archi**: `Errore -[COINVOLGE]-> Modulo`, `Fix -[RISOLVE]-> Errore`,
`Fix -[TOCCA]-> Modulo`, `VoceKB -[EXTRACTED_FROM]-> Documento`.

Versioning del Fix (fix rivisto una seconda volta dopo l'applicazione iniziale):
**deliberatamente rimandato** — aggiunta a basso costo differito (un attributo
`version`/`iteration` in più sul nodo esistente, nessuna modifica strutturale),
non implementato in questa fase.

---

## 1C.1 — Vocabolario controllato, business layer (definitivo)

### Nodi

⚠️ Tabella ricostruita il 21/08/2026 dopo che una riscrittura precedente di
questo stesso file aveva perso silenziosamente diversi nodi/predicati già
approvati nei round precedenti di questa conversazione (non scartati per
decisione esplicita — persi in fase di riscrittura). Recuperati rileggendo
il transcript reale della conversazione, non da memoria. Vedi nota in fondo
al documento.

| Nodo | Ancoraggio reale | Note |
|---|---|---|
| `Modulo`, `Modello` | — | livello codice, vedi 1A — già reali |
| `Errore`, `Fix` | — | vedi 1B |
| `Documento` | `erpv6.library.document` | sorgente/provenienza — reale, verificato in Fase 0 |
| `VoceKB` | `erpv6.kb` | la conoscenza estratta. Categoria KB **resta attributo, non nodo** (vedi decisione sotto). Assorbita nel nodo `Fix` solo quando `kb_type='changelog_tecnico'` (vedi 1B) |
| `Azienda` / `Cliente` | `res.partner` | modello Odoo standard, un solo tipo di nodo |
| `Socio` | *nuovo, non esiste oggi* | collegato ad Azienda/Cliente tramite `HAS_SHAREHOLDER` (vedi dettaglio sotto) |
| `Prodotto` | `erpv6.package.module` | non `product.product` generico — qui "prodotto" è il servizio/pacchetto di consulenza (campi reali: `code`, `name`, `price`, `description`) |
| `Settore` / `Vertical` | `erpv6.vertical.catalog` | lista chiusa reale già esistente e popolata, 15 voci verificate |
| `Bando` | **`erpv6.bando`** (singolare) | + `erpv6.bando.application`/`.match`/`.source` già esistenti. ⚠️ Verificato ora via grep sul codice reale (`_name = 'erpv6.bando'` in `odoo-modules/erpv6_bandi/models/bando.py:12`) dopo che questo documento aveva scritto per errore `erpv6.bandi` (plurale) — nome sbagliato, corretto qui |
| `AreaTerritoriale` | — | generalizzazione di "Regione" (vedi sotto) |
| `Persona` | `res.users` / campo `author_id` su `erpv6.kb` | **SOLO riferimenti oggettivi** (autore/responsabile documento) — mai inferenze psicologiche/motivazionali |
| `ProfiloDISC` | — | **`not_yet_populated: true`**. Il questionario esiste concettualmente ma oggi non c'è alcun modulo Odoo né alcun dato reale raccolto. Nodo previsto nello schema, non popolabile ora |
| `TipoSocietà` | — | vocabolario chiuso, forme giuridiche italiane: SRL, SRLS, SNC, SAS, Ditta Individuale, Cooperativa, SPA, ... |
| `Norma` | — | normativa/regola fiscale |
| `Scadenza` / `Importo` | — | **non nodi**: proposti come attributi d'arco (`HAS_DEADLINE`/`HAS_AMOUNT` con valore data/importo direttamente sull'arco) per evitare di gonfiare il grafo con nodi-valore isolati senza identità propria. Alternativa possibile se serve confrontare scadenze tra loro: nodo dedicato — non assunto qui, da decidere se serve |

### `Socio` — dettaglio (già specificato in un round precedente, ripristinato qui)

- arco: `Azienda`/`Cliente` **-[HAS_SHAREHOLDER]->** `Socio`
- attributi minimi, **solo quelli rilevanti per l'idoneità a bandi**:
  `ownership_percentage`; `age_range` oppure `birth_year`; `gender`
  **solo se richiesto da criteri di bando reali** (es. età/genere prevalente
  dei soci — casi reali: ON-Nuove Imprese, Resto al Sud)
- **minimizzazione dati esplicita**: nessun altro dato personale del socio
  va estratto oltre a quanto necessario per il matching di idoneità
- `source`: visura camerale (dato pubblico) — **mai inferenza**

### `AreaTerritoriale` (generalizzazione di "Regione")

Motivazione reale, non ipotetica: il bando "Fondo deindustrializzazione" si
applica a comuni specifici dei consorzi industriali di Lazio/Marche, non a
intere regioni — uno schema con "geografia = solo Regione" avrebbe richiesto
una ri-migrazione costosa alla prima applicazione di un bando così.

- `sottotipo`: `regione` | `zona_montana` | `comune_specifico` | `zona_industriale` | `zona_svantaggiata` | ...
- `membri`: lista esplicita di comuni/codici ISTAT, **obbligatoria quando `sottotipo != regione`**
  (mai testo libero). Per `sottotipo=regione`, `membri` è derivabile dalla mappatura
  statica già costruita e verificata (`erpv6_devtools/graph/province_to_region_it.py`,
  111 province reali → 20 regioni, nessuna inventata). Per gli altri sottotipi
  non esiste mappatura automatica: va popolata caso per caso quando un bando
  reale la richiede — stesso principio di `flagged_missing_data`, mai stimata.

### `ProfiloDISC` — dettaglio

- arco: `Cliente -[HAS_DISC_PROFILE]-> ProfiloDISC`
- `source`: **campo obbligatorio**, valori chiusi tipo `questionnaire_self_assessment`
  — **mai** un valore che ammetta un'inferenza AI del profilo (il profilo DISC
  deve venire da un'autovalutazione dichiarata dal cliente, non da un giudizio
  automatico)
- attributi minimi: `punteggio`/`profilo`, `data_compilazione`
- `not_yet_populated: true` sul nodo stesso, per chiarire nello schema che è
  previsto ma con zero dati reali oggi — non deve sembrare una fonte già
  disponibile per l'estrazione
- la raccolta del dato (modulo Odoo o form cliente) è un **task separato e
  successivo**, non implementato in questa fase — solo lo spazio nello schema

### Predicati

| Predicato | Da → A | Note |
|---|---|---|
| `depends_on` | Modulo → Modulo | già reale, Fase 1A |
| `relates_to` | Modello → Modello | già reale, Fase 1A |
| `COINVOLGE` | Errore → Modulo | vedi 1B |
| `RISOLVE` | Fix → Errore | vedi 1B |
| `TOCCA` | Fix → Modulo | vedi 1B |
| `EXTRACTED_FROM` | VoceKB → Documento | ripristinato — necessario per risalire a quale documento ha generato quale tripla (problema reale visto con la KB #24 orfana) |
| `HAS_SHAREHOLDER` | Azienda/Cliente → Socio | **ripristinato** — era assente nella versione precedente di questo file, nodo `Socio` restava orfano |
| `RELATED_TO_PRODUCT` | VoceKB → Prodotto | ripristinato |
| `RELATED_TO_CLIENT` | VoceKB → Azienda/Cliente | ripristinato |
| `HAS_DEADLINE`, `HAS_AMOUNT` | attributi sull'arco, non verso un nodo | ripristinati — vedi nota su Scadenza/Importo sopra |
| `APPLIES_TO_AREA` | Bando/Norma → AreaTerritoriale | **rinominato** da `APPLIES_TO_REGION` dopo la generalizzazione |
| `APPLIES_TO_SECTOR` | Bando/Norma → Settore/Vertical (`erpv6.vertical.catalog`) | |
| `APPLIES_TO_LEGAL_FORM` | Norma → TipoSocietà | |
| `REQUIRES_LEGAL_FORM` | Bando → TipoSocietà | per bandi con vincoli sulla forma giuridica |
| `HAS_DISC_PROFILE` | Cliente → ProfiloDISC | vedi sopra, `not_yet_populated` |

Qualunque predicato non in questa lista, se l'AI lo proponesse durante
un'estrazione reale, va segnalato come proposta di estensione dello schema —
mai creato al volo.

### Decisione: Categoria KB → nodo o attributo?

Regola concordata: **nodo solo se vocabolario chiuso E serve interrogare
attraverso più documenti**; frammentato/monouso → attributo.

Verificato con dati reali (`erpv6.kb.read_group([], ['category_id'], ['category_id'])`,
50 categorie reali totali):

- 42 categorie su 50 hanno **1 sola voce** (monouso, es. "Età", "Divieti",
  "Sales timing", ...) — chiaramente attributo.
- Le restanti 7 con più di una voce (Pattern Linguistici 20, Principi
  Decisionali 16, Regole Kaizen 12, Non Verbale 12, Changelog Tecnico 7,
  Prompts di Sistema 7, Obiezioni 6) sono state controllate direttamente:
  `count(DISTINCT source)` = 1 (o 0) e `count(DISTINCT source_document_id)` = 0
  per **tutte e 7**, senza eccezioni. Nessuna attraversa più fonti/documenti oggi.

**Decisione: Categoria KB resta attributo per tutte le 50 categorie reali
attuali.** Nessuna qualifica come nodo secondo la regola concordata.

⚠️ **Questa è una fotografia dello stato attuale, non una decisione permanente.**
Le KB sono in popolamento attivo proprio in questi giorni (estrazioni in corso
e da riprendere sui documenti #9/#25/#26, più eventuali nuovi documenti). Ogni
nuova voce che entra in una categoria già esistente, soprattutto se proviene
da un `source_document_id` diverso da quello delle voci già presenti, può far
scattare la condizione "usato da più documenti" e ribaltare l'esito per quella
specifica categoria. **Prima di implementare per davvero questa parte dello
schema (Fase 1C.2 in poi), va rieseguito lo stesso `read_group` con dati
freschi** — non riusare i numeri di questo documento come se fossero ancora
validi a distanza di tempo. Se in futuro una categoria comincia realmente ad
aggregare voci da più documenti diversi, questa decisione va rivista con lo
stesso metodo (dati reali, non supposizione).

---

## Backlog trovato durante questo lavoro (non affrontato ora)

1. **Moduli `fenice_*` installati sull'istanza sbagliata.** Installati e
   funzionanti, ma destinati a un altro database — lì per errore/in attesa di
   essere sistemati, non residuo morto. Flag `installed_on_wrong_instance: true`
   già presente nei nodi del grafo (Fase 1A). Stessa famiglia di problema dei 6
   moduli desincronizzati già noti. Non affrontato in questa fase.

2. **Categoria "KB estratte — in attesa di validazione" triplicata** —
   `category_id` 37 (30 voci), 38 (39 voci), 44 (7 voci), stesso nome,
   record distinti. Trovata durante la query `read_group` di questa stessa
   revisione. Resta segnalata, **non toccata** — nessuna deduplicazione fatta
   né qui né altrove finché non viene decisa esplicitamente con l'utente.

3. **Canale di raccolta profilo DISC** — form/modulo Odoo per far compilare il
   questionario al cliente (autovalutazione, mai inferenza AI). Task separato
   e successivo rispetto allo schema del grafo; qui è stato solo previsto lo
   spazio (nodo `ProfiloDISC`, `not_yet_populated: true`).

---

## Riconciliazione del 21/08/2026 — diff rispetto alla versione precedente

Una prima riscrittura di questo documento (stessa data, poche ore prima) aveva
perso silenziosamente elementi già approvati in round precedenti di questa
conversazione — non scartati per decisione esplicita, persi nel passaggio di
riscrittura. Recuperati rileggendo il transcript reale (righe 4239/4707/4762),
non da memoria. Diff rispetto alla versione precedente di questo file:

**Ripristinato (nodi)**: `Errore` (mancava del tutto, con i suoi archi
`COINVOLGE`/`RISOLVE`/`TOCCA`); `Documento` (citato nel predicato
`EXTRACTED_FROM` ma non esisteva come riga nella tabella nodi — un arco
verso il nulla); `Persona` (`res.users`/`author_id`, solo riferimenti
oggettivi); `Azienda`/`Cliente` ora esplicitamente ancorato a `res.partner`
(prima solo "Cliente" senza ancoraggio); `Prodotto` (`erpv6.package.module`,
sparito interamente insieme al suo predicato).

**Ripristinato (predicati)**: `HAS_SHAREHOLDER` (Azienda/Cliente → Socio —
il predicato più discusso di questo lavoro, minimizzazione dati e fonte
visura camerale; senza di esso il nodo `Socio` restava orfano, senza alcun
arco che lo collegasse a Cliente); `RELATED_TO_PRODUCT`, `RELATED_TO_CLIENT`
(collegavano VoceKB a Prodotto/Cliente); `HAS_DEADLINE`, `HAS_AMOUNT`
(attributi d'arco per Scadenza/Importo, decisi esplicitamente come
NON-nodi — non comparivano più da nessuna parte).

**Corretto (attributi dettagliati)**: `Socio` aveva regredito a "attributi
non ancora specificati, da definire" — ripristinati quelli già decisi con
precisione: `ownership_percentage`, `age_range`/`birth_year`, `gender` solo
se richiesto da criteri di bando reali, fonte visura camerale, minimizzazione
dati esplicita.

**Corretto (nome modello, verificato ora via grep sul codice reale)**:
`Bando` era ancorato a `erpv6.bandi` (plurale, **inesistente**) — il nome
reale verificato è **`erpv6.bando`** (singolare), confermato in
`odoo-modules/erpv6_bandi/models/bando.py:12` (`_name = 'erpv6.bando'`).

**Corretto (nodo `Fix`)**: le due fonti REALI di oggi sono `erpv6.kb`
(`kb_type='changelog_tecnico'`) e `erpv6.agent.proposal`
(`status='actioned'`) — la versione precedente presentava un commit git
come fonte già disponibile, quando in realtà git/GitHub è solo un
arricchimento **futuro**, non ancora una fonte reale collegata.

**Invariato**: la decisione "Categoria KB → attributo, non nodo" (con il
caveat "fotografia, non permanente"), `AreaTerritoriale`, `ProfiloDISC`,
`TipoSocietà`, `Norma`, le due viste del grafo codice, e la sezione backlog
— nessuno di questi era in discussione, restano come nella versione
precedente.

## Stato dopo questo documento

Schema 1B + 1C.1 riconciliato. **Fermato qui come richiesto — nessuna
estrazione reale di triple, nessuna implementazione, finché non viene
rivisto e autorizzato esplicitamente.**

---

## 1C.1-bis — Layer Vendita/Comunicazione (vocabolario controllato, IMPLEMENTATO il 22/08/2026)

Denis ha dato il via libera di massima alla direzione ("creiamo sicuramente
anche il secondo layer") il 22/08/2026, dopo che un'analisi precedente aveva
trovato — leggendo la KB reale, non a memoria — un intero secondo strato di
conoscenza (metodologia vendita/comunicazione) mai coperto da
`ALLOWED_TRIPLE_SHAPES`. Schema mostrato per intero, poi Denis ha risposto
alle 3 decisioni aperte (normalizzazione FaseVendita, inclusione DISC,
"estendi ora il codice") e il layer è stato implementato — vedi "Stato dopo
questa sezione" in fondo per il dettaglio implementazione/verifica.

Perché un layer separato da 1C.1 (bandi/business) e non un'estensione dello
stesso vocabolario: **verificato ora, non solo dedotto** — nessuna delle voci
di questo layer nomina un'azienda, un bando o un cliente reale specifico
(vedi query di verifica sotto). È conoscenza di metodo astratta. I predicati
restano quindi intra-layer (`VoceKB` → `FaseVendita`, `VoceKB` →
`FrameworkTeorico`, `VoceKB` → `ProfiloDISCTipo`), mai collegati a `Bando`/
`Azienda`/`Norma` del layer 1C.1.

### Dati reali — riverificati il 22/08/2026 (query dirette su `erpv6`, non a memoria)

| Famiglia | Codice | Voci nette | Categoria/kb_type reale | Stato `is_active` |
|---|---|---|---|---|
| Pattern Linguistici | `PL` | **20** (PL-01…PL-20) | categoria "Pattern Linguistici" (id 52), `kb_type=psicologico` | `true` |
| Comportamentale/timing | `PC` | **15** (PC-01…PC-15) | 15 mono-categorie tipo "Engagement alto" (id 64-78), `kb_type=psicologico` | `true` |
| Principi Decisionali | `PD` | **16** (PD-01…PD-16) | categoria "Principi Decisionali" (id 79), `kb_type=psicologico` | `true` |
| Non Verbale | `NV` | **12** (NV-01…NV-12) | categoria "Non Verbale" (id 80), `kb_type=psicologico` | `true` |
| Dinamiche multi-decisore | `MD` | **7** (MD-01…MD-07) | categoria "KB estratte — in attesa di validazione" (id 44), `kb_type=industriale` | **`false`** (non ancora validate dai 6 Giudici) |
| Marcatori messaggistica | `DM` | **15** (DM-01…DM-15) — *corretto da stima iniziale ~8* | dentro categorie staging id 37/38, `kb_type=psicologico` | **`false`** |
| Obiezioni | `OB` | **10** (OB-01…OB-10) — *corretto da stima iniziale ~7* | dentro categorie staging id 37/38, `kb_type=psicologico` | **`false`** |

Nota importante emersa solo ora dalla riverifica: **PL, PC, PD, NV sono già
`is_active=true`** (hanno passato il gate), mentre **MD, DM, OB sono ancora
`is_active=false`**, in attesa di validazione. Lo schema sotto vale per
tutte e 7 le famiglie indipendentemente da questo, ma l'estrazione reale di
triple (fase successiva, non questa) toccherebbe famiglie a stati diversi
della pipeline — da tenere presente quando si deciderà come/quando estrarre.

Formato comune confermato sul dato reale (pipe-delimited dentro `content`),
con differenze reali per famiglia:

| Famiglia | Campi reali nel `content` (ordine) |
|---|---|
| `PL` | codice \| trigger \| interpretazione \| spiegazione \| azione \| **fase** \| **framework** \| confidenza |
| `PC` | codice \| trigger \| interpretazione \| spiegazione \| azione \| **fase** \| framework* \| confidenza |
| `PD` | codice \| trigger(nome principio) \| interpretazione \| spiegazione/esempio \| azione \| **framework** \| confidenza *(niente fase)* |
| `NV` | codice \| trigger \| **contesto_osservazione** (testo libero, NON è un valore di FaseVendita) \| interpretazione \| azione \| **nota_debrief** \| confidenza *(niente framework, niente fase)* |
| `MD` | ID \| Dinamica(trigger) \| Segnali Riconoscimento(trigger dettagliato) \| **Rischio se Ignorata** \| Strategia(azione) \| **Frase da Usare** (script) \| P:confidenza *(campi con etichetta esplicita nel testo, non solo posizionali)* |
| `DM` | codice \| trigger \| esempio testuale \| interpretazione \| azione \| **fase** \| confidenza *(niente framework)* |
| `OB` | codice \| obiezione(trigger) \| interpretazione \| azione/script di risposta \| **cosa_non_dire** (anti-pattern) \| confidenza *(niente fase, niente framework)* |

\* per `PC` ho verificato che il campo framework **manca sempre** nei 15 record
reali — la stima iniziale "PC ha framework" non regge sul dato, corretto qui.

`FaseVendita` — valori reali visti (grezzi, prima di normalizzazione), solo
in PL/PC/DM: `Prima call`, `Pre-call`, `Durante call`, `Post-prima call`,
`Post-proposta`, `Post-proposta / Post-follow-up` (valore composito), `Seconda
call`, `Prima e seconda call`, `Prime fasi` (nuovo, trovato solo ora su
DM-12 — non sinonimo ovvio di nessuno degli altri), `Qualsiasi fase` /
`Qualsiasi` (sinonimi).

**Normalizzazione — decisa il 22/08/2026** (regola generale di Denis:
sinonimi esatti si fondono, valori compositi diventano più archi verso fasi
atomiche, mai un nodo-fase composito nuovo). Vocabolario canonico risultante
(9 valori atomici, costante `FASE_VENDITA_CANONICAL` nel codice):
`Pre-call`, `Prima call`, `Seconda call`, `Durante call`, `Post-prima call`,
`Post-proposta`, `Post-follow-up`, `Prime fasi`, `Qualsiasi fase`.

| Valore grezzo reale | Normalizzato in |
|---|---|
| `Qualsiasi` | `Qualsiasi fase` (sinonimo esatto) |
| `Prima e seconda call` | **2 archi**: `Prima call` + `Seconda call` (composito) |
| `Post-proposta / Post-follow-up` | **2 archi**: `Post-proposta` + `Post-follow-up` (composito — `Post-follow-up` diventa così un valore atomico a sé, prima esisteva solo dentro questo composito) |
| `Prime fasi` (DM-12, id 227) | **tenuto distinto** da `Prima call` — ragionamento: il contenuto reale di DM-12 ("Non usa mai il tuo nome in nessun messaggio" / "Relazione ancora formale O stile comunicativo generico") descrive un periodo iniziale generico della relazione via messaggistica, non la telefonata specifica "prima call". La famiglia DM è basata sui messaggi, non sulle chiamate: forzare "Prime fasi" dentro "Prima call" avrebbe presupposto un'equivalenza che il testo non dichiara — violerebbe la regola "mai un'inferenza non giustificata dal testo" |
| tutti gli altri valori grezzi | invariati (già atomici) |

Implementato in codice come `_FASE_VENDITA_MAP` + `_normalize_fase_vendita_triple()`
in `kb_extraction_service.py`: un valore grezzo non presente nella mappa
**non viene scartato** (potrebbe essere un sinonimo reale non ancora
catalogato) — passa con l'oggetto originale ma con un log esplicito per
revisione umana, mai una fusione indovinata. Testato dal vivo (vedi sezione
"Verifica" sotto).

`FrameworkTeorico` — confermato vocabolario aperto: 29 etichette distinte
viste solo in PL+PD (NLP, SPIN Selling, Cialdini — Influence, Cialdini —
Social Proof, Kahneman — Prospect Theory, Kahneman — TFAS, Watzlawick,
Tajfel, Ariely, Petty & Cacioppo, Schwartz, Rackham, framework proprietari
tipo "AgroHub — Kairos Matrix", ecc.) — mai un enum fisso, coerente con la
decisione già presa per questo campo nell'analisi preliminare.

`Confidenza` — chiuso `{ALTA, MEDIA, BASSA}` confermato su **tutte e 7** le
famiglie senza eccezioni (attributo, non nodo — stessa decisione già presa
per il layer bandi).

### Nodo proposto: `PatternComportamentale` (uno solo, non 7 nodi distinti)

**Scelta motivata dall'evidenza**, non a priori: la forma
trigger→interpretazione→azione→confidenza è identica nelle 7 famiglie: unica
differenza reale è QUALI campi opzionali sono popolati (fase, framework,
script, cosa_non_dire, contesto_osservazione, nota_debrief, rischio). Sette
tipi di nodo quasi-identici avrebbero duplicato lo stesso set di predicati
sette volte senza guadagnare nulla — stesso principio già applicato in 1C.1
per non fratturare `Azienda`/`Cliente` in due tipi. Un nodo unico con
attributo `famiglia` chiuso e attributi opzionali sparsi (popolati solo
quando il testo li fornisce) riflette meglio il dato reale.

**Anchoring**: `erpv6.kb` (stesso modello di `VoceKB` in 1C.1) — non un
modello nuovo. Ogni record che rientra in questo layer porta **entrambe** le
label nel grafo (`VoceKB` + `PatternComportamentale`, pattern multi-label già
deciso in 1C.3 per lo stesso motivo: `EXTRACTED_FROM → Documento` resta
valido gratis su ogni pattern, senza duplicare il predicato).

| Attributo | Obbligatorio? | Famiglie in cui compare | Note |
|---|---|---|---|
| `codice` | quasi sempre | tutte e 7 | es. "PL-01", "MD-03". **1 eccezione reale trovata**: record id 217 "DM-03" ha `content` troncato/malformato (manca tutto tranne codice+trigger) — se ricorre in fase di estrazione reale, va `flagged_missing_data`, mai completato per inferenza |
| `famiglia` | sì | tutte e 7 | chiuso `{PL,PC,PD,NV,MD,DM,OB}` |
| `trigger` | sì | tutte e 7 | segnale osservabile / obiezione testuale / dinamica — normalizzato in un unico nome di attributo pur avendo etichette diverse nel testo grezzo |
| `interpretazione` | sì | tutte e 7 | |
| `azione` | sì | tutte e 7 | in MD corrisponde al campo "Strategia" |
| `confidenza` | sì | tutte e 7 | chiuso `{ALTA,MEDIA,BASSA}`, attributo non nodo |
| `fase_vendita` | opzionale | **solo** PL, PC, DM | verificato: PD/NV/MD/OB non hanno mai questo campo |
| `framework_teorico` | opzionale | **solo** PL, PD | verificato: PC/NV/MD/DM/OB non hanno mai questo campo (anche PC, corretto rispetto alla stima iniziale) |
| `script_frase` | opzionale | **solo** MD, OB | testo esatto suggerito da dire al cliente |
| `cosa_non_dire` | opzionale | **solo** OB | anti-pattern esplicito |
| `contesto_osservazione` | opzionale | **solo** NV | testo libero, NON è un valore di FaseVendita (es. "Al momento di citare il prezzo", "Negli ultimi 10 minuti") |
| `nota_debrief` | opzionale | **solo** NV | presente in tutte e 12 le voci NV senza eccezioni |
| `rischio_se_ignorata` | opzionale | **solo** MD | |

### Nodi di supporto

| Nodo | Motivazione (nodo, non attributo) |
|---|---|
| `FaseVendita` | Vocabolario chiuso + usato trasversalmente da ~50 voci di 3 famiglie diverse (query reale utile: "quali pattern si applicano in Post-proposta") — stessa regola già applicata a `Settore`/`AreaTerritoriale` in 1C.1 |
| `FrameworkTeorico` | Nodo con **membri aperti** (stesso pattern già accettato per `AreaTerritoriale.membri` quando `sottotipo≠regione`) — valore aggiunto solo quando il testo lo cita esplicitamente, mai enum fisso. Permette query tipo "quali pattern citano Cialdini" senza dover riaggregare per stringa ogni volta |
| `ProfiloDISCTipo` | **Incluso su richiesta esplicita di Denis il 22/08/2026** ("io includerei le voci di disc"). Vedi dettaglio dedicato sotto — diverso dal nodo `ProfiloDISC` già in 1C.1, che resta `not_yet_populated` e rappresenta il profilo *assegnato a un cliente reale*, non la tassonomia teorica |

### `ProfiloDISCTipo` — dettaglio (incluso il 22/08/2026)

Ancoraggio reale: 10 voci `erpv6.kb` (`kb_type=psicologico`, categoria
staging id 38, tutte `is_active=false`): id 231 "Dominante", 232 "Influente",
233 "Stabile" (ciascuna un unico record con tutte le sfaccettature nel
`content`, pipe-delimited) + id 234-240, le **7 sfaccettature di "Analitico"
frammentate in 7 record separati** (uno per sfaccettatura: comportamento,
valori, paure, stile di comunicazione, fattori di frustrazione,
raccomandazioni operative, output atteso) — differenza strutturale reale tra
come sono state inserite le prime 3 e la quarta, non un'invenzione.

Diverso nella forma da `PatternComportamentale`: **non c'è un
trigger→interpretazione→azione su un'interazione specifica**, è materiale di
riferimento sul framework stesso (cosa significa "un cliente Dominante").
Per questo resta un nodo a sé, non una famiglia aggiuntiva di
`PatternComportamentale`.

Attributi (dal `content` reale, posizionali per D/I/S, per etichetta
esplicita nel `name` per Analitico):
- `nome`: valore letterale come compare nel testo — `Dominante`, `Influente`,
  `Stabile`, `Analitico`. **Nota**: il testo scrive esplicitamente "D —
  DOMINANTE", "I — INFLUENTE", "S — STABILE" (lettera+nome), ma **mai** una
  lettera per "Analitico" (mai scritto "C — Analitico" da nessuna parte nel
  dato reale) — quindi non aggiungo una lettera "C" per coerenza con lo
  standard DISC esterno: sarebbe un'inferenza mia, non presente nel testo.
  Uso solo `nome` letterale, mai una lettera per Analitico.
- `comportamento_osservabile`, `valori`, `paure`, `stile_comunicazione`,
  `fattori_frustrazione`, `approccio_consigliato` (per Analitico l'etichetta
  reale nel `name` è "Raccomandazioni operative Analitico", stesso slot
  semantico), `output_atteso`.

**Limite tecnico noto, non risolto qui**: per D/I/S un solo record `erpv6.kb`
contiene già tutte le sfaccettature; per Analitico sono 7 record separati che
vanno **unificati in un solo nodo grafo** a tempo di costruzione del grafo
(non durante l'estrazione AI, che lavora voce per voce) — stesso genere di
step deterministico già previsto per il parsing degli altri attributi di
`PatternComportamentale` dal `content` pipe-delimited, non un problema
dell'estensione di oggi.

**Predicato verso il resto dello schema**: **nessuno osservato nel dato
reale** — verificato esplicitamente (grep) che nessuna delle 7 famiglie
pattern nomina "Dominante"/"Influente"/"Stabile"/"Analitico" per nome, e
nessuna delle 10 voci DISC cita un codice pattern. Aggiunto comunque
`TYPICAL_OF_PROFILE` in `ALLOWED_TRIPLE_SHAPES` come **vocabolario
disponibile per documenti futuri** (stessa logica con cui `APPLIES_TO_LEGAL_FORM`
fu aggiunta nel layer bandi sulla base della plausibilità di dominio, non di
ogni singola istanza già testata) — si popolerà solo se un documento futuro
lo dichiara esplicitamente, il prompt non lo forza mai.

### Predicati proposti (aggiornato — implementati il 22/08/2026)

| Predicato | Da → A | Evidenza |
|---|---|---|
| `APPLIES_IN_PHASE` | `VoceKB` → `FaseVendita` | solo per record PL/PC/DM che hanno il campo valorizzato. Subject_type `VoceKB` (non un nuovo "PatternComportamentale"): stessa riga `erpv6.kb`, la label aggiuntiva si assegna a tempo di costruzione del grafo in base a kb_type/categoria, non in fase di estrazione AI |
| `BASED_ON` | `VoceKB` → `FrameworkTeorico` | solo per record PL/PD che hanno il campo valorizzato |
| `TYPICAL_OF_PROFILE` | `VoceKB` → `ProfiloDISCTipo` | **zero istanze osservate oggi** — vocabolario disponibile per documenti futuri, vedi dettaglio `ProfiloDISCTipo` sopra |

**Nessun altro predicato proposto.** Ho verificato esplicitamente (grep sul
`content` reale) se un'Obiezione (`OB`) cita mai un codice `PL`/`PD`/`NV`/`MD`
nel proprio testo, per un eventuale legame diretto Obiezione↔Pattern: **zero
occorrenze trovate**. Non creo quindi nessun predicato che collega le
famiglie tra loro — solo un'ipotesi plausibile a priori, non giustificata dal
testo. Stesso esito per un eventuale legame verso `Azienda`/`Bando`/`Norma`
del layer 1C.1: nessuna voce delle 7 famiglie nomina un'azienda, un bando o
un cliente reale specifico (verificato via query su `SRL|SPA|SNC|SAS|bando`
su tutto il contenuto delle 7 famiglie — gli unici 2 riscontri erano falsi
positivi: "SRL" usato in modo generico come forma giuridica descrittiva in
MD-05, non riferito a un'azienda reale).

### Fuori perimetro — trovato durante la riverifica, resta fuori

**~11 voci miste non-pattern** nelle stesse categorie di staging: contenuto
su "Metodo Sakshi"/libro/biografia (id 291-297), note interne di utilizzo
della KB ("Cosa Non Fare", "Aree Geografiche Usate", "Range Età Usati",
"Obiettivo KB Esperienza", id 142-145). Non pattern, non tassonomia DISC —
restano `VoceKB` generiche senza triple, nessuna azione richiesta, segnalate
solo perché condividono le categorie di staging con DM/OB/DISC e vanno
escluse per nome/forma quando si processeranno nuovi documenti simili.

### Anomalie di qualità dati trovate durante la riverifica — RESTANO APERTE

Segnalate qui per tracciabilità, **non risolte in questo lavoro né in questo
giro** (vincolo: sola lettura sulla KB in questo compito) — da riprendere in
un giro dedicato ai duplicati, separato da questo lavoro di schema/estrazione,
per non mischiare le due cose come richiesto esplicitamente da Denis:

- **Record `DM-03` (id 217) malformato**: `content` troncato dopo trigger,
  mancano interpretazione/azione/fase/confidenza.
- **Duplicati NON ancora gestiti** (diversi dai 32 già deduplicati stanotte,
  verificato: quelli restano `is_active=false` con nota in chatter — questi
  no): `PL-12` … `PL-18` (7 codici) esistono **due volte ciascuno**, stesso
  contenuto identico, **entrambe le copie `is_active=true`** — una in
  categoria "Pattern Linguistici" (id 52, record id 47-53), una duplicata in
  7 mono-categorie separate (id 86-92, record id 152-158).
- Categoria id 85, nominata "Obiezioni", contiene in realtà **6 voci `PL`**
  duplicate e già disattivate (`PL-05`…`PL-10`) — non voci `OB`. Errore di
  categorizzazione residuo dal lavoro di dedup di stanotte (contenuto già
  gestito correttamente, is_active=false, solo la categoria ha un nome
  fuorviante).

### Stato dopo questa sezione — IMPLEMENTATO il 22/08/2026

Denis ha risposto alle 3 domande aperte (normalizzazione FaseVendita sopra,
DISC incluso, "sì, estendi ora il codice") e ha confermato di procedere
anche con MD/DM/OB ancora `is_active=false` — le triple su quelle voci si
estrarranno naturalmente solo quando/se passeranno dai 6 Giudici, la
pipeline lo gestisce già da sola, non serve aspettare.

Implementato in `odoo-modules/erpv6_omni_bridge/models/kb_extraction_service.py`:
- `ALLOWED_TRIPLE_SHAPES` esteso con `('VoceKB','APPLIES_IN_PHASE','FaseVendita')`,
  `('VoceKB','BASED_ON','FrameworkTeorico')`, `('VoceKB','TYPICAL_OF_PROFILE','ProfiloDISCTipo')`
  — layer bandi esistente intatto, nessuna riga rimossa.
- `FASE_VENDITA_CANONICAL` + `_FASE_VENDITA_MAP` (mappatura sinonimi/compositi
  descritta sopra) + `_normalize_fase_vendita_triple()`: guardrail lato
  Python che normalizza/espande ogni tripla `APPLIES_IN_PHASE`, mai fidandosi
  del solo prompt — stesso principio già usato per `SHAREHOLDER_ATTRIBUTE_KEYS`.
- `EXTRACTION_SYSTEM_PROMPT` esteso con un paragrafo dedicato ai 3 nuovi tipi
  di nodo (vocabolario canonico FaseVendita generato dalla stessa costante,
  non duplicato a mano; guida su FrameworkTeorico aperto; guida su
  ProfiloDISCTipo con i 4 valori reali).
- Detector `TRIPLE_DISCOVERY_*` (aggiunto da Denis stanotte, indipendente da
  questo lavoro) lasciato intatto — verificato via `git diff` prima di
  editare, come richiesto, dopo la promozione concorrente di un fix
  diagnostico sullo stesso file da parte di un altro agente.

**Compilazione**: `python3 -m py_compile` OK. **Lock**: `pg_stat_activity`
verificato vuoto (nessuna query attiva) prima della promozione.
**Promosso**: `./scripts/promote_module.sh erpv6_omni_bridge` — Step 1/2
riusciti ("✅ Installazione su staging riuscita, nessun errore rilevato"),
servizio Odoo riavviato senza errori. Step 3 (aggiornamento "produzione")
saltato deliberatamente: `STAGING_DB`/`PROD_DB` puntano entrambi a `erpv6`
in questa configurazione, quindi il DB reale è già aggiornato dallo Step 2.

**Verificato dal vivo** (odoo shell, non solo dedotto dal codice), stesso
metodo già usato per il layer bandi in 1C.2:
- Tripla valida `APPLIES_IN_PHASE` con valore composito reale `"Prima e
  seconda call"` → **espansa correttamente in 2 triple** (`Prima call` +
  `Seconda call`).
- Tripla valida `BASED_ON` → `FrameworkTeorico` con valore reale `"Cialdini —
  Influence"` → passata intatta (vocabolario aperto).
- Tripla valida `TYPICAL_OF_PROFILE` → `ProfiloDISCTipo` con valore
  `"Dominante"` → passata (shape nuova, mai osservata nel dato ma nel
  vocabolario ammesso).
- Tripla fuori vocabolario `VoceKB -HAS_MOOD-> EmozioneCliente` → **scartata**
  con log esplicito (`"tripla scartata, combinazione fuori vocabolario
  controllato... mai creata al volo"`), come da guardrail.
- Valore FaseVendita sconosciuto (`"Terza call mai vista prima"`, mai visto
  nel dato reale) → **non scartato**, passato con l'oggetto originale e un
  log esplicito per revisione umana, come da design (mai scartato in
  silenzio, mai fuso per indovinare).
- `EXTRACTION_SYSTEM_PROMPT.format()` verificato senza `KeyError`, contiene
  tutti e 3 i nuovi tipi di nodo e tutti e 9 i valori canonici di FaseVendita.

**Standard confermato**: dal 22/08/2026 il layer Vendita/Comunicazione è
attivo per ogni nuovo documento in ingestion, stesso standard già in vigore
dal 21/08/2026 per il layer bandi. Nessun backfill sulla KB esistente (le
70+32+10 voci già in KB per questo layer non vengono ritoccate da questa
estensione — coerente con il vincolo "nessuna scrittura sulla KB esistente"
di questo compito).

---

## 1C.2 — Estrazione reale delle triple (autorizzata ed eseguita il 21/08/2026)

Denis ha dato il via libera esplicito il 21/08/2026 ("il punto 1 ok").
Implementato e promosso su `erpv6`:

- `ALLOWED_TRIPLE_SHAPES` (vocabolario controllato, tuple
  `(subject_type, predicate, object_type)`) in
  `odoo-modules/erpv6_omni_bridge/models/kb_extraction_service.py`, generato
  da un'unica fonte condivisa con il testo del prompt (mai due liste che
  possono andare fuori sincrono).
- `EXTRACTION_SYSTEM_PROMPT` esteso con un campo `triples` per voce
  (vincolato alle combinazioni ammesse) e un campo separato
  `proposed_new_predicates` per tutto cio' che l'AI trova nel testo ma non
  rientra nel vocabolario — mai forzato dentro `triples`.
- `_clean_triples()`/`_log_proposed_triple_extensions()`: guardrail lato
  Python, non si fida solo del prompt — scarta con un log esplicito
  qualunque tripla fuori vocabolario anche se l'AI la mettesse per errore
  direttamente in `triples`.
- Campo `extracted_triples` (Json, default `[]`) su `erpv6.kb`
  (`odoo-modules/erpv6_kb/models/kb_knowledge.py`) — le triple viaggiano
  dentro il record KB stesso, che resta `is_active=False` finche' non passa
  dal gate `erpv6_validation` (6 Giudici) come qualunque altra voce.
- `extracted_triples` incluso in `context_data` per i Giudici
  (`odoo-modules/erpv6_production/models/kb_validation_gate.py`).

**Verificato dal vivo (non solo dedotto dal codice)**: campione reale (bando
"Resto al Sud", Campania/Calabria, 50.000€, scadenza, SRL/SRLS, socia 60%
da visura camerale) → triple corrette prodotte e filtrate: `HAS_DEADLINE`,
`HAS_AMOUNT`, `APPLIES_TO_AREA`×2, `REQUIRES_LEGAL_FORM`×2,
`HAS_SHAREHOLDER` con `attributes` minimizzati (`ownership_percentage`,
`source: visura_camerale`, niente altro). Guardrail testato apposta con un
caso fuori vocabolario (bando cofinanziato da un consorzio bancario,
predicato `FINANCED_BY`/`HAS_COFINANCIATOR` inesistente): l'AI lo ha messo
di sua iniziativa in `proposed_new_predicates`; testato anche a livello
Python puro (`_clean_triples` chiamato direttamente con input sintetico)
che scarta con log esplicito 2 triple fuori vocabolario su 3, lasciando
sopravvivere solo quella valida — ne' scartate in silenzio ne' create al
volo.

**Standard confermato**: dal 21/08/2026 ogni nuovo documento in ingestion
passa da questa pipeline estesa automaticamente. Nessun backfill sulla KB
esistente (vedi 1C.3 sotto — proposta, non eseguita).

**Bug collaterale trovato, indagato, ancora aperto**: la risposta AI
(`openai/gpt-oss-120b` via Groq) ha fallito il parsing JSON due volte
("Extra data", un `]` di troppo in coda) durante i test del guardrail.
Diagnosi comparativa OLD-schema (piatto, pre-1C.2) vs NEW-schema (con
`triples` annidate) eseguita il 21/08/2026: 1 successo OLD, 1 successo NEW,
poi 4 tentativi falliti per esaurimento provider reale (429/402/circuit
breaker) prima di raccogliere altri campioni — **campione troppo piccolo per
essere conclusivo**. Nella sessione, i 2 casi di JSON malformato osservati
erano entrambi con lo schema NEW, 0 con l'OLD, ma n=1 per l'OLD non prova
nulla statisticamente. Nessuna fix proposta finche' non c'e' un campione
piu' solido — da riprendere se richiesto esplicitamente.

---

## 1C.3 — Applicazione: nuovi documenti (attivo) + proposta backfill KB esistente

Denis ha dato il via libera esplicito il 21/08/2026 ("procedi con i punti
1c.3 e 1d") — **per la sola fase di proposta/disegno**, non per l'esecuzione
reale del backfill (richiede una conferma esplicita separata, come da
vincolo permanente).

**Nuovi documenti**: gia' attivo, vedi 1C.2. Nessuna azione ulteriore.

**Backfill KB esistente — PROPOSTA, non eseguita**

Dati reali (query dirette su `erpv6`, sera del 21/08/2026 — da riverificare
al momento dell'esecuzione, la KB e' in popolamento attivo):

| kb_type | totale | source | note |
|---|---|---|---|
| psicologico | 109 | 103 da `library_document:9:documento_kb_operative.xlsx`, 6 da doc #26 | comunicazione/DISC (Pattern Linguistici, Principi Decisionali, Non Verbale, Obiezioni — vedi read_group 1C.1); improbabile che citi Bando/Azienda/Norma, ma non verificato voce per voce |
| metodo_v6 | 66 | 51 da doc #9, 14 senza source (create manualmente), 1 da doc #26 | misto, alcuni potenzialmente in ambito |
| industriale | 7 | tutti da doc #9 | in ambito |
| normativo | 1 | da doc #12 `TEST_B_estrazione_kb.txt` | nome suggerisce dato di test/debug — da confermare con Denis se e' contenuto reale prima di includerlo |
| fiscale, artigianale | 0 | — | niente da fare |
| prompt | 7 | `system_seed` | ESCLUSO — prompt di sistema AI, non conoscenza di business |
| changelog_tecnico | 9 | — | ESCLUSO — gia' fuori dal motore per costruzione (`KB_TYPE_EXCLUDED_FROM_ENGINE`) |

Totale candidati: **183 voci KB**, provenienti da soli 3 documenti sorgente
reali (doc #9, #12, #26) piu' 14 voci manuali senza documento sorgente.
Due tier proposti, a scelta di Denis:
- **Tier "core"** (74 voci: industriale + normativo + metodo_v6) — maggiore
  probabilita' di contenere Bando/Azienda/Norma/Settore.
- **Tier "completo"** (183 voci, include anche psicologico) — copertura
  totale ma una parte consistente (109/183, ~60%) probabilmente a vuoto.

**Design tecnico proposto (non implementato)**:
- Opera DIRETTAMENTE su `erpv6.kb.content` gia' esistente — NON riprocessa
  il documento originale (niente re-chunking, niente rigenerazione di
  `name`/`kb_type`/`category`, gia' validati e da non toccare).
- Prompt dedicato, piu' stretto di `EXTRACTION_SYSTEM_PROMPT` (che oggi fa
  anche name/kb_type/category/content) — solo estrazione triple da un
  content gia' dato. Stesso `ALLOWED_TRIPLE_SHAPES`, stesso `_clean_triples`
  riusato (mai duplicato).
- Scrive SOLO `extracted_triples` via `write()` sul record esistente — non
  ricrea il record, non lo fa ripassare dai 6 Giudici (il contenuto
  approvato non cambia, solo un arricchimento di metadata); un
  `message_post` in chatter per tracciabilita'.
- **Gap trovato da colmare prima di eseguire**: `extracted_triples` ha
  `default=list`, quindi `[]` significa sia "non ancora processato" sia
  "processato, zero triple trovate" — indistinguibile. Serve un campo
  separato (es. `triples_backfill_at`, Datetime, vuoto=non fatto) prima di
  lanciare il job reale, altrimenti un'interruzione a meta' non sa da dove
  ripartire senza rirocessare tutto. Non aggiunto ora di proposito — tocca
  ancora il modello `erpv6.kb`, va rivisto insieme a Denis prima.
- **Throttling/batch**: stesso pacing `CHUNK_PACING_SECONDS=65s` gia' in
  produzione (stesso limite Groq condiviso — punto 3 restato "non urgente"
  ma il design lo rispetta comunque). Batch via cron, mai un processo
  sincrono unico. Stima tempo: tier core 74×65s ≈ 80 minuti, tier completo
  183×65s ≈ 3h20 (solo stima, non misurata dal vivo).
- **Resumability**: checkpoint per id gia' processato, batch di N record a
  botta, commit esplicito ogni batch — stesso pattern di
  `_commit_kb_extraction_batch` gia' in produzione (`library_document.py`).

**Scelta singolo-grafo-multi-label vs grafi separati (motivata)**

Entro il grafo di business (`Bando`, `Azienda`, `Socio`, `Norma`,
`AreaTerritoriale`, `Settore`, `TipoSocieta`, `VoceKB`, `Documento`,
`Persona`): **un solo grafo con label multiple per nodo** (pattern nativo
Neo4j), mai grafi separati per famiglia di entita'. Motivazione: il valore
del grafo sta esattamente nell'attraversamento cross-entita' — es. "quali
Aziende sono idonee a quali Bandi via AreaTerritoriale condivisa" richiede
`Bando`/`Azienda`/`AreaTerritoriale` nello stesso grafo, non federabili a
runtime senza un join applicativo che vanificherebbe il senso di usare un
grafo. Vedi 1D sotto per come questo si combina con il vincolo tecnico reale
trovato su Neo4j Community Edition (una sola database per istanza) — la
separazione codice/business (1A vs 1B+1C.1) resta comunque motivata (zero
overlap di query oggi tra i due), ma va realizzata o come due istanze
separate o come un solo grafo con namespace di label, non come "due
database logiche nella stessa istanza Community".

---

## 1D — Proposta infrastruttura Neo4j Community Edition (proposta, container NON avviato)

Denis ha dato il via libera esplicito il 21/08/2026 ("procedi con i punti
1c.3 e 1d") — **per la sola proposta** (compatibilita' porte, risorse,
docker-compose scritto/mostrato). L'avvio reale di un nuovo container resta
un secondo gate esplicito separato, non coperto da questo via libera.

**Vincolo reale trovato, cambia il piano originale**: verificato via ricerca
(non supposizione) — Neo4j Community Edition supporta **una sola "standard
database" per istanza/DBMS**. Multi-database attivo simultaneo e' una
feature Enterprise Edition (a pagamento). Il piano originale "due database
logiche (`erpv6_code_graph`, `erpv6_kb_graph`) nella stessa istanza
Community" non e' tecnicamente realizzabile cosi' come descritto.

Fonti:
- https://neo4j.com/docs/operations-manual/current/database-administration/
- https://community.neo4j.com/t/can-we-have-multiple-database-on-community-edition/16265
- https://community.neo4j.com/t/limitation-of-neo4j-community-edition/74547

**Tre strade reali, a scelta di Denis (nessuna avviata)**:

- **Opzione A (consigliata)** — un'istanza Neo4j Community, un solo
  database, separazione logica via label (es. prefisso `Code_Modulo`/
  `Code_Modello` vs `Kb_Bando`/`Kb_Azienda`/..., o una label aggiuntiva
  comune `:CodeGraph`/`:KbGraph` su ogni nodo oltre alla label specifica).
  Costo extra zero, un solo container, una sola porta. Contro: stesso
  spazio di indici/constraint per i due namespace — gestibile con
  disciplina nei nomi.
- **Opzione B** — due istanze/container Neo4j Community separati (uno per
  code_graph, uno per kb_graph), ciascuno con la sua unica database
  standard. Isolamento fisico reale (non solo logico). Costo: 2x container,
  2x JVM heap, 2x porte (7474/7687 e 7475/7688). Fattibile sulle risorse
  disponibili (vedi sotto) ma raddoppia l'overhead operativo per un
  beneficio che oggi non ha un caso d'uso concreto (nessuna query ha mai
  bisogno di isolare fisicamente i due grafi, solo logicamente).
- **Opzione C** — Neo4j Enterprise Edition (licenza gratuita solo per
  sviluppo/non-produzione, a pagamento per produzione). Supporta
  multi-database nativo come originariamente ipotizzato. Non consigliata
  senza una ragione di business specifica: introduce vincoli di licenza per
  un progetto che oggi ha ancora zero triple reali in produzione.

Il `docker-compose.yml` proposto sotto implementa l'**Opzione A** di
default, scritto in modo che passare all'Opzione B richieda solo duplicare
il blocco `service` (nessuna riscrittura).

**Risorse reali host (verificate il 21/08/2026)**: 4 vCPU, 7.8GiB RAM
totali (~3.9GiB "available" contando la cache riusabile), 53GB disco liberi
su `/`. Container attuali (stack Documenso + Odoo + Postgres) usano insieme
~1.05GB RAM realmente allocati (verificato via `docker stats --no-stream`).
Proposto per Neo4j: heap JVM 1G, page cache 512m, limite container 1.5G RAM
— margine ampio anche con tutto il resto attivo, dato lo storage previsto
(853 nodi/4765 archi oggi nel grafo codice, ordine di grandezza poche
decine di MB, lontanissimo dai GB anche sommando un futuro grafo business
di poche centinaia di nodi).

**Porte**: 7474 (HTTP browser) e 7687 (Bolt) — nessun conflitto (l'host oggi
espone pubblicamente solo 80/443 via Caddy, tutto il resto gira solo su
rete Docker interna, verificato via `docker compose ps`). Proposto di NON
pubblicare queste porte su `0.0.0.0` ma solo su `127.0.0.1`, coerente con
la postura del resto dello stack — un accesso futuro alla UI richiederebbe
un tunnel SSH o un reverse proxy Caddy dedicato con autenticazione, da
decidere quando/se serve davvero.

**Isolamento**: docker-compose SEPARATO da `/opt/erpv6/docker-compose.yml`
(mai toccato il file esistente), rete Docker propria (non condivisa con la
rete di erpv6/documenso), volumi dedicati. File proposto:
`erpv6_devtools/graph/neo4j/docker-compose.yml` (fuori da `odoo-modules/`
di proposito, stesso principio degli altri script di questa cartella —
tooling interno, non modulo Odoo installabile).

**Password**: nessuna password reale in questo repository. Il
docker-compose legge `${NEO4J_PASSWORD}` da un file `.env` locale non
tracciato (vedi `erpv6_devtools/graph/neo4j/.env.example`), stesso
principio di non mettere mai un segreto reale in un file versionato.

---

## Stato dopo questo documento (aggiornato 21/08/2026)

1C.2 implementato, testato dal vivo e confermato standard. 1C.3 e 1D:
**proposta e disegno completi, nessuna esecuzione** — backfill KB esistente
non lanciato, container Neo4j non avviato. In attesa di conferma esplicita
separata per ciascuno dei due step successivi (via libera al backfill
reale; via libera all'avvio del container Neo4j).

---

## 1D — Import eseguito (22/08/2026)

Container `erpv6_kg_neo4j` avviato (Opzione A confermata, docker-compose
proposto in 1D sopra) e sano al momento di questo import — porte solo su
`127.0.0.1:7474`/`127.0.0.1:7687`, password letta da
`erpv6_devtools/graph/neo4j/.env` locale (gitignored, mai stampata).

**Driver Python**: nessun `neo4j` driver disponibile nell'ambiente di
sistema (`pip3` assente, `ensurepip` non installato via apt senza sudo).
Creato un venv locale isolato in `erpv6_devtools/graph/neo4j/.venv/`
(`python3 -m venv --without-pip` + bootstrap `get-pip.py`, nessuna modifica
al Python di sistema, nessuna libreria aggiunta al container Odoo di
produzione), `neo4j==6.2.0` installato lì. `.venv/` già coperto dal
`.gitignore` globale del repo (pattern `.venv/`).

**Script**: `erpv6_devtools/graph/neo4j/import_code_graph.py`. Legge
`orm_graph_2026-08-21.json`, crea nodi `Code_Modulo`/`Code_Modello` (label
per `kind`, tutti gli attributi reali del nodo copiati come proprietà,
incluso `owning_module` sui modelli) e archi `DEPENDS_ON`/`RELATES_TO` con
`type` originale mantenuto come attributo. Vincolo di unicità su `id` creato
per entrambe le label (`code_modulo_id_unique`, `code_modello_id_unique`).
Tutto via `MERGE`, mai `CREATE`.

**Dettaglio tecnico trovato durante l'implementazione**: 963 coppie
`(source, target)` su 2999 negli archi `relates_to` hanno più di un arco
reale (stesso modello collegato all'altro tramite più campi ORM diversi,
es. `account.account → res.currency` via sia `company_currency_id` sia
`currency_id`). Un `MERGE` sulla sola coppia `(source, target)` li avrebbe
collassati in un solo arco, perdendo dati reali. Corretto includendo
`via_field` nella chiave di `MERGE` della relazione — verificato con query
diretta post-import che entrambi gli archi `account.account → res.currency`
sopravvivono distinti con i rispettivi `via_field`. Nessuna duplicazione
analoga trovata su `depends_on` (0 coppie duplicate).

**Import eseguito ed eseguito una seconda volta per verificare
l'idempotenza** — conteggi identici in entrambe le esecuzioni:

| | atteso (dal JSON) | 1° run | 2° run |
|---|---|---|---|
| nodi `Code_Modulo` | 164 | 164 | 164 |
| nodi `Code_Modello` | 689 | 689 | 689 |
| archi `DEPENDS_ON` | 459 | 459 | 459 |
| archi `RELATES_TO` | 4306 | 4306 | 4306 |

Nessuna riga scartata, nessun errore — il JSON sorgente è risultato già
pulito (853 id univoci, 0 archi verso nodi inesistenti, verificato prima
dell'import).

**Query di verifica reali eseguite post-import** (non stimate):

- Conteggio nodi per label: `Code_Modello` 689, `Code_Modulo` 164.
- Conteggio archi per tipo: `RELATES_TO` 4306, `DEPENDS_ON` 459.
- "Quali moduli dipendono da `erpv6_kb`" → 12 moduli reali: `erpv6_agent`,
  `erpv6_api_gateway`, `erpv6_bandi`, `erpv6_brand`, `erpv6_color`,
  `erpv6_deep_source`, `erpv6_kaizen`, `erpv6_omni_bridge`, `erpv6_package`,
  `erpv6_production`, `erpv6_saas`, `erpv6_typst`.
- "Quanti modelli ha `erpv6_production`" (via `owning_module`) → 8 modelli.
- Moduli con `installed_on_wrong_instance: true` → 2 reali,
  `fenice_lead_automation` e `fenice_market_intelligence` (coerente con il
  problema noto in backlog, punto 1 sopra).

**Non fatto in questo step, di proposito**: nessun dato business (1B/1C.1)
importato — quel grafo non esiste ancora, come da vincolo del task.
Namespace `Kb_` resta riservato e inutilizzato.

---

## Estensione — Motore Kaizen "copertura grafo" (progettato per intero il 22/08/2026)

Disegno completo e definitivo in `docs/KAIZEN_rule_application_worked_example.md`
(applicazione sistematica delle 12 Regole Kaizen a un caso reale, con
correzione documentata di un errore reale — numeri riusati invece che
riverificati — lasciata visibile come lezione). Punti chiave:

- Kaizen deve applicare **tutte e 12** le regole ad ogni segnale, scrivendo
  ogni risposta in una tabella temporanea legata al segnale (mai fidarsi
  della sola "memoria di conversazione" — dimostrato dal vivo che si perde).
- Ogni valutazione produce **due artefatti**: un file `.md` con il
  ragionamento completo, e una voce `erpv6.kb` (`changelog_tecnico`) che
  diventa un nodo `Fix` reale (Fase 1B), collegato nel grafo (`TOCCA`) al
  `Code_Modulo`/`Code_Modello` già esistente coinvolto — nessun nodo nuovo
  "Sensore" inventato, si riusano i nodi codice già importati.
- L'Indicatore 5 di Kairós ("esperienza pregressa") va risposto con una
  **query reale sul grafo** (quali `Fix` sono già collegati a questo stesso
  Modulo/Modello), non con una ricerca testuale o una supposizione — primo
  caso d'uso concreto per il motore di interrogazione condiviso.
- Rete Docker: `erpv6_kg_neo4j` collegato anche a `erpv6_default` (oltre
  alla propria rete isolata) dal 22/08/2026, per permettere a Odoo/Kaizen
  di scrivere davvero nel grafo. Neo4j resta comunque isolato dall'esterno
  (porte solo su `127.0.0.1`).

**Non ancora costruito** (prossimo passo): il codice reale del motore di
valutazione a 12 regole, la scrittura del Fix node in Neo4j dal server Odoo,
il collegamento a Sabrina per la notifica finale.
