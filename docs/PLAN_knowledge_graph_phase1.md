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
