# Proposta di collaborazione — Hera Energia / V6 Impresa
**Bozza di lavoro — 24/08/2026**
**Riferimento**: Relazione tecnico-commerciale fotovoltaico ricevuta da Stefano Puglisi (Hera), 24/08/2026

---

## 1. Contesto

Hera fornisce oggi consulenza tecnica fotovoltaico interamente manuale: raccolta bollette, analisi consumi,
sopralluogo, scelta configurazione (Trina Solar/ZCS Azzurro standard vs 3SUN per iperammortamento),
preventivo. Il processo è descritto nel documento ricevuto (sez. 5 e 6): dati da raccogliere, step operativi,
divisione dei ruoli tra Hera (tecnico) e professionista fiscale (bandi/agevolazioni).

Non esiste oggi uno strumento digitale che colleghi questi passaggi: tutto passa per PDF, email, relazioni Word.

**Ipotesi di partenza**: V6 Impresa può costruire un verticale "Preventivi Fotovoltaico" (stesso pattern di
AgroHub: qualification, KB, generazione documenti via `erpv6_typst`) che digitalizza in parte o del tutto
questo processo, e proporlo a Hera come collaborazione a più livelli.

---

## 2. Tre modelli di collaborazione (alternativi, non cumulativi)

| Modello | Descrizione | Sviluppo richiesto | Rischio |
|---|---|---|---|
| **A. Tool white-label per i consulenti Hera** | Modulo preventivi usato da Stefano (e colleghi) per raccogliere dati, dimensionare, generare PDF | Medio — riusa typst/package/interview già esistenti | Basso, controllo tuo, primo caso reale = tua pratica Tosi Mati |
| **B. Lead-gen puro** | AgroHub qualifica lead agricoli interessati al FV, li gira a Hera | Nullo — funnel già esistente | Dipendi dal volume lead, ruolo marginale |
| **C. Licenza SaaS rete Hera** | Come A ma rivenduto a tutta la rete consulenti Hera a livello nazionale | Alto — serve multi-tenant, onboarding, supporto | Prematuro, da validare dopo A |

**Nota**: la conversazione con Hera è partita sul modello lead-gen (B), con proposta iniziale di Hera di **3%**
di fee sul chiuso. Valutato basso rispetto al mercato (referral grezzo 5-10%) e soprattutto rispetto al lavoro
di qualificazione che V6 può automatizzare.

---

## 3. Proposta a 3 livelli (escalation progressiva)

### Livello 1 — Solo Lead
- **Fornisci**: nominativo, contatto, interesse dichiarato, tipo azienda, superficie indicativa
- **Non fai**: nessuna qualificazione tecnica
- **Fee proposta**: 5% sul valore contratto chiuso *(vs 3% offerto)*
- **Sviluppo**: minimo — funnel AgroHub esistente

### Livello 2 — Lead + Bandi
- **Fornisci**: come L1 + verifica preliminare agevolazione (iperammortamento sì/no, requisito tecnico —
  es. necessità moduli 3SUN Registro ENEA)
- **Valore per Hera**: gli arriva già l'informazione che oggi aspetta dal "professionista incaricato"
  (risparmia uno step del processo — vedi sez. 6 punto 1 del documento Hera)
- **Fee proposta**: 8% sul valore contratto chiuso
- **Sviluppo**: KB regole bandi/iperammortamento (logica fiscal rules deterministiche già presente in
  `erpv6_validation`) collegata al lead

### Livello 3 — Lead + Dossier completo + Licenza consulenti
- **Fornisci**: fascicolo pre-qualificato completo — bollette caricate/analizzate, consumi, superficie/
  orientamento, attività e stagionalità agricola, potenza consigliata, configurazione standard vs 3SUN
  (sostanzialmente i punti 5 e 3 del documento Hera già svolti)
- **Più**: licenza d'uso piattaforma ai consulenti Hera, per la loro gestione preventivi in generale
  (non solo sui lead portati da te)
- **Fee proposta**: modello misto —
  - canone SaaS fisso mensile/per consulente (indipendente da chiusura)
  - + % ridotta (3-4%) solo sui lead generati da te che chiudono
  - *Razionale*: protegge dal rischio "Hera non chiude" quando il lavoro tecnico è già stato fatto da te

---

## 4. Punti da chiarire con Hera prima di formalizzare (validi su tutti i livelli)

- [ ] Base di calcolo della %: imponibile impianto, o valore contratto totale (incluso accumulo/opere)?
- [ ] Attribuzione: come si prova che un lead è "tuo" (evitare dispute)?
- [ ] Tempistica pagamento: alla firma contratto, o a fine lavori/collaudo?
- [ ] Esclusiva territoriale/di settore (agricolo) per un periodo definito, o Hera può girare gli stessi
      lead ad altri partner?
- [ ] Chi possiede/gestisce i dati raccolti (bollette, consumi) — GDPR, conservazione, riuso?
- [ ] Cosa succede se il consulente Hera modifica/rifiuta la configurazione proposta dal dossier — resta comunque fee L3?

---

## 5. Domande aperte per me stesso (da sciogliere a freddo)

- Quanto tempo/energia voglio investire ora sul modulo "Preventivi Fotovoltaico" vs altre priorità
  aperte (repo/VPS desync, erpv6_typst design decision, tree→list audit)?
- Ha senso partire da L1 (rischio zero, fee bassa) per costruire fiducia, e proporre L2/L3 solo dopo
  aver dimostrato valore con la mia pratica Tosi Mati come primo caso reale?
- Il modulo preventivi FV è un vero nuovo verticale (come Falegnameria/Vitivinicolo/Agriturismo già in
  roadmap) o un'estensione di AgroHub?
- Se va in porto L3, la licenza ai consulenti Hera è compatibile con l'isolamento architetturale già
  in uso (multi-brand, `erpv6_whitelabel`) o serve un progetto a parte?

---

## 6. Riposizionamento: proposta commerciale V6 Impresa (non "idea per Hera")

Invece di presentare questo come un'iniziativa nata per risolvere la pratica fotovoltaico di Tosi Mati,
ha più senso trattarlo come una **proposta commerciale di collaborazione firmata V6 Impresa** — coerente
col posizionamento del brand come piattaforma di consulenza/business plan.

**Vantaggi di questo framing:**
- V6 Impresa è già il brand dedicato a consulenza/business plan — la proposta ci sta dentro senza forzature
- **Riusabilità**: diventa un template di proposta commerciale, non un documento unico per Hera —
  riproponibile ad altri partner/settori in futuro (coerente con approccio multi-brand)
- **Posizionamento**: ci si presenta come "V6 Impresa offre una piattaforma di qualificazione lead e
  gestione dossier tecnico", non come "un'idea estemporanea legata a un caso personale" — sposta la
  conversazione da negoziazione di una fee a presentazione di un servizio

**Cosa cambia nel documento finale:**
- Meno peso sulla trattativa % (5-8% vs 3%), più peso su cosa V6 Impresa offre come piattaforma/servizio
- Serve una breve sezione di apertura "chi è V6 Impresa" per un lettore esterno che non conosce
  l'architettura interna
- **Disclosure necessaria**: il caso Tosi Mati va presentato esplicitamente come *pilota/caso di validazione*,
  non come motivazione originaria — stessa logica di trasparenza già in uso per il case study AgroHub
  (Tosi Mati DSCR)

---

## 7. Sequenza operativa (da rispettare in ordine)

1. **Finalizzare la proposta commerciale V6 Impresa** (livello/i scelto/i, condizioni, punti aperti sez. 4 risolti)
2. **Validare/concordare con Hera** — solo dopo un accordo (anche di massima) sul modello e sulle condizioni
3. **Solo a quel punto**: design del verticale/modulo "Preventivi Fotovoltaico" (nuovo verticale vs estensione
   AgroHub, campi, flusso interview, aggancio a `erpv6_bandi`) e implementazione

**Perché in questo ordine**: costruire il modulo prima di un accordo rischia di sviluppare sul livello/modello
sbagliato (es. si progetta per L3 con licenza consulenti, ma Hera accetta solo L1 lead-gen) — lavoro da rifare.
La proposta commerciale definisce lo scope tecnico, non il contrario.

---

## 8. Riposizionamento: acquisizione Hera = istanza del ciclo V6 Impresa (non pipeline separato)

Il ciclo V6 Impresa è pensato come generico per qualsiasi consulente/business — non solo per clienti finali.
Acquisire Hera come partner non è quindi un caso speciale da gestire con un pipeline CRM ad hoc, ma
un'istanza del progetto di tipo **Acquisizione**, applicato da V6 Impresa a se stessa:

- il "cliente" della metodologia è Hera stessa
- le fasi dinamiche standard (es. Pareto→Kairós→5S) diventano gli stage di acquisizione partnership:
  Contatto → Proposta → Negoziazione → Accordo di massima → Contratto in revisione → Partner attivo
- il "costo" non è l'investimento di un cliente, ma il **costo di acquisizione partner**
  (tempo, sconti negoziati sulla fee, eventuale sviluppo anticipato prima del ritorno)
- coerente con il principio motore vs conoscenza: non si cambia il motore, cambia solo il soggetto e
  cosa rappresenta il "costo"

**Sottotipo esplicito**: dentro il tipo progetto Acquisizione, si distingue tra:
- **Acquisizione Cliente** — funnel verso un cliente finale (es. azienda agricola per il fotovoltaico)
- **Acquisizione Partnership** — funnel verso un partner/collaboratore (es. Hera)

Stesso motore/fasi dinamiche di `erpv6_methodology`, ma sottotipo tracciato per avere una vista/categoria
immediata (dashboard, reportistica) senza mescolare acquisizione clienti e acquisizione partner nello stesso
raggruppamento visivo, pur restando entrambi istanze dello stesso ciclo.

**Contratto/firma**: lo stage "Contratto in revisione" riusa l'infrastruttura già esistente
(`erpv6_contract` + `erpv6_sign` via Documenso, già live su `firma.v6sviluppoimpresa.it`) — stesso motore
usato per NDA cliente, con template diverso per accordo di partnership.

**Da verificare prima di implementare (si aggancia a decisioni già aperte nel backlog):**
- Se le fasi di tipo Acquisizione generano oggi to-do/timing consulente, o sono solo concettuali
  (era già domanda aperta — confermare esplicitamente prima di implementare)
- Se "Acquisizione Partnership" richiede solo un flag/sottotipo su `project_id`, o un modello dedicato
  leggero che eredita dallo stesso schema

**Lead cliente finale (tipo A, es. azienda agricola FV) resta distinto**: vive nel funnel `crm.lead`
standard verso il partner attivo (Hera), e comincia ad arrivare solo dopo che lo stage "Partner attivo"
è stato raggiunto.

---

*Sequenza invariata (sez. 7): la modellazione di questo sottotipo Acquisizione Partnership resta comunque
successiva alla proposta commerciale e all'accordo con Hera — qui si sta solo fissando dove andrà collocato
concettualmente, non implementando.*

---

## 9. Principio guida di lungo periodo: V6 Impresa come motore generico per qualsiasi consulente

Il ragionamento fatto su Hera conferma un principio già presente nell'architettura (motore vs conoscenza):
il motore — fasi metodologia, tipo progetto Acquisizione/Delivery, pipeline lead, firma contratti
(`erpv6_sign`), generazione documenti (`erpv6_typst`) — non contiene nulla di specifico su un settore.
Quello che cambia per ogni dominio è solo la conoscenza: KB, campi interview, template documento, regole
fiscali/tecniche. `erpv6.vertical.catalog` (15 verticali italiane) e `erpv6_whitelabel` vanno già in questa
direzione.

Se il motore è davvero generico, la conseguenza naturale è che possa essere **licenziato white-label ad
altri consulenti o gruppi di consulenti** per il proprio business — stesso salto concettuale del Livello 3
per Hera, ma applicato in generale.

**Cautela — da trattare come ipotesi da validare, non come fatto acquisito:**
Oggi esiste un solo caso end-to-end realmente validato (AgroHub). Hera sarebbe il secondo. La direzione
architetturale è corretta, ma va confermata con almeno 2 casi concreti prima di progettare in astratto per
"qualsiasi consulente" — rischio tipico: over-engineering, costruire un motore troppo generico prima di
aver visto dove davvero non generalizza (campi che non si adattano, fasi che in un dominio non hanno senso).

**Conclusione**: questo resta un principio guida di lungo periodo, non un requisito da soddisfare subito nel
modulo fotovoltaico. Il modulo fotovoltaico resta il secondo caso di validazione del motore, non il banco
di prova dell'astrazione totale.

### 9.1 Onboarding nuovo dominio: wizard KB alla prima installazione

Quando si crea un dominio di lavoro differente (nuovo verticale/nuovo consulente white-label), serve un
**wizard di prima installazione** per popolare la KB di quel dominio — invece di richiedere setup manuale
o ingestion ad hoc ogni volta. Idea già presente da chiarire e sviluppare in una sessione dedicata
(dettagli, step del wizard, cosa raccoglie, come si aggancia alla pipeline KB esistente — 6 Giudici,
upload → estrazione AI → record inattivi → approvazione umana).

*Da riprendere e discutere a parte quando si arriva a questo punto della sequenza (sez. 7).*

---

*Prossimo passo immediato: sciogliere i dubbi sez. 4 e 5, poi trasformare in documento Word formale
(proposta commerciale V6 Impresa) da inviare a Stefano — solo per il livello/i livelli scelti.
Il design del modulo/verticale fotovoltaico, del sottotipo Acquisizione Partnership e del wizard KB
nuovo dominio restano bloccati finché il punto 2 della sequenza (accordo con Hera) non è chiuso.*
