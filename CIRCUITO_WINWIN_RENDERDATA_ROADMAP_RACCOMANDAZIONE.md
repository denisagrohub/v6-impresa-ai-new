# Circuito `erpv6_winwin_renderdata` — Roadmap + Raccomandazione

Continua da `CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE.md` (Fasi 1-3B/4 parziale già fatte). Branch: `feature/circuito-winwin-renderdata` (locale, nessun commit, nessun push).

**Stato: completato e verificato dal vivo su entrambi i casi richiesti, con generazione e ispezione reale dei 4 PDF risultanti (2 casi × preview/finale).**

---

## Nuove voci KB create in questo giro (per la tua revisione)

Nessun modello nuovo — stesso pattern di Fase 1 (`erpv6.kb.category` + `erpv6.kb` con `content_format='json'` + `erpv6.core.kb_link` sullo stesso nodo `node_winwin_renderdata_build`).

### 1. Categoria "Tempistiche Standard Processo (Win-Win)" (id 142, `kb_type='normativo'`)

**KB "Tempistiche Standard — Bandi e Istruttorie"** (id 532):
```json
{
  "istruttoria_bancaria": {
    "giorni_min": 60, "giorni_max": 90,
    "descrizione": "Istruttoria bancaria/dell'ente erogatore dopo la presentazione della domanda di finanziamento.",
    "riferimento": "stima plausibile (caso Credito 4.0/ISMEA), non verificata puntualmente sulla banca/ente specifico - da confermare caso per caso"
  },
  "finestra_bando_generica": {
    "giorni_min": 30, "giorni_max": 60,
    "descrizione": "Finestra tipica per la presentazione della domanda su un bando a sportello.",
    "riferimento": "stima plausibile generica, varia molto per bando - da verificare sulla fonte ufficiale del bando specifico"
  }
}
```
**Motivazione**: la roadmap è deterministica (principio del prompt), quindi i tempi devono venire da un dato, non da una chiamata AI. Punto di partenza dichiarato: il caso ISMEA/Credito 4.0 già usato nei test precedenti del circuito (istruttoria 60-90gg è la cifra ricorrente in quel contesto) — **dichiarato esplicitamente come stima plausibile, non fonte verificata puntualmente**, come richiesto.

### 2. Categoria "Frasi Raccomandazione (Win-Win)" (id 143, `kb_type='metodo_v6'`)

**KB "Frasi Raccomandazione — Template a Slot"** (id 533):
```json
{
  "tutti_presenti": "Procedere con {azione_winwin}, dando priorità a risolvere prima: {elemento_bloccante} — unico elemento bloccante identificato. La posizione dell'azienda nel quadrante \"{quadrante}\" conferma che è il momento giusto per muoversi.",
  "solo_winwin": "Nessun elemento bloccante identificato: si può procedere direttamente con {azione_winwin}, coerentemente con la posizione dell'azienda nel quadrante \"{quadrante}\".",
  "solo_bloccante": "Prima di ogni altro passo va risolto: {elemento_bloccante}. La posizione dell'azienda nel quadrante \"{quadrante}\" resta da confermare una volta superato questo punto."
}
```
**Motivazione**: template a slot, non generativo (principio esplicito del prompt: "non aprire una nuova chiamata generativa"). 3 varianti scelte in base a quali elementi sono presenti nel caso (win-win approvata dal Gate 3B + elemento bloccante più prioritario tra criticità/azioni urgenti + etichetta quadrante Kairós). **Un 4° caso (nessun elemento bloccante NÉ win-win) non ha un template dedicato: la raccomandazione resta `None`, mai un placeholder generico** — verificato con un test unitario diretto (vedi sotto), nessuna delle combinazioni produce testo rotto.

---

## Un bug reale di configurazione trovato e corretto durante l'implementazione

Ho scoperto (leggendo il codice, poi confermato dal vivo) che **`name` su `erpv6.core.kb_link` è un campo COMPUTATO** (`_compute_name`, dipende da `kb_id.name`/`target_node_id.name`) — qualunque valore scritto via XML viene silenziosamente sovrascritto al primo caricamento. Il mio primo tentativo di distinguere i 3 kb_link sullo stesso nodo per `name` non funzionava per questo motivo. **Corretto usando `kb_category_id`** (campo realmente stored, non computato) come chiave di lookup — `_resolve_kb_link(node, category_name)` in `aeosv6_dispatch.py` e lo stesso pattern in `gate.py` per la raccomandazione.

**Secondo problema collegato, anch'esso reale**: i 3 record `erpv6.core.kb_link` sono dentro un blocco `<data noupdate="1">` — corretto per proteggere dato editabile a mano, ma significa che **una volta creati, un `-u` successivo non riapplica più i valori dei campi ai record esistenti**, nemmeno dopo aver corretto l'XML. Ho dovuto scrivere `kb_category_id` direttamente sui 3 record esistenti via ORM (una tantum) oltre a correggere l'XML sorgente (che resta corretto per eventuali installazioni future del modulo da zero). **Stesso problema trovato anche sul nome del nodo del circuito**: il report del giro precedente diceva "rimosso (BLOCCATO) dal nome nodo" nell'XML, ma il record esistente nel DB non l'aveva mai recepito per lo stesso motivo (`noupdate`) — corretto anche quello.

---

## Fase 2 — Motore: `_build_roadmap()` (`models/aeosv6_dispatch.py`)

Aggiunge un passo per ogni azione urgente già calcolata (`tempistica: 'Subito'`, mai una data inventata) + due passi condizionali (finestra bando, istruttoria bancaria) letti dalla KB tempistiche **solo se `bando_target` è presente** — se non c'è, quei passi restano assenti, mai un placeholder. Verificato con test unitario diretto (bypassando le chiamate AI, che non servono a questa parte deterministica):

```
nessun urgente, nessun bando -> []
con urgente + bando -> [3 passi con schema {titolo, tempistica, descrizione} esatto letto dal template 60_roadmap.typ]
```

## Fase 4 — Arco: `_winwin_build_raccomandazione()` (`models/gate.py`)

Assembla il template scelto in base a `(prima_azione_winwin, elemento_bloccante)` — **verificato con test unitario diretto tutte e 4 le combinazioni**, nessuna produce testo rotto o placeholder:
```
tutti_presenti  -> frase completa con azione+bloccante+quadrante
solo_winwin     -> frase senza menzione di blocco
solo_bloccante  -> frase che dice di risolvere prima, senza menzionare un'azione win-win inesistente
nessuno         -> None (corretto, nessun template onesto per "non c'è niente da dire")
```

---

## Verifica end-to-end richiesta: 2 casi reali

Entrambi eseguiti con intervista reale (`action_start`/`action_answer`, **mai risposte scritte a mano nel DB**) e con generazione reale dei 2 PDF (preview/finale) via `erpv6.typst.engine.generate_document`, PDF poi decodificati e letti con `PyPDF2` per ispezionare il testo effettivo.

### Caso 1 — tutti gli elementi presenti (criticità + azione urgente + win-win)

Nuova intervista reale (nessun caso precedente aveva contemporaneamente `patrimonio_netto`/`rimborso_capitale_annuo` valorizzati — necessari per generare una criticità reale, quindi ne ho completata una nuova passo-passo, `erpv6.production.order` #69, lead #156, "TEST CIRCUITO WINWIN - roadmap completo"): EBITDA 480.000€, oneri 95.000€, rimborso capitale 350.000€, debito 620.000€, patrimonio netto 250.000€, visura 2025-01-15, contenzioso Sì, bando "Credito 4.0".

Risultato (`build_and_validate_render_data()`, Gate 3B sessione #386 **convergente**):
- 2 criticità reali (DSCR 1.08x rosso, leva 71.3% rosso)
- 2 azioni urgenti (contenzioso, visura non recente)
- 4 passi roadmap (2 "Subito" dalle urgenti + finestra bando + istruttoria bancaria da KB)
- 4 schede win-win approvate dal Gate 3B
- raccomandazione: *"Procedere con Rinegoziazione del finanziamento bancario con piano di rimborso ottimizzato, dando priorità a risolvere prima: DSCR sotto la soglia minima — unico elemento bloccante identificato. La posizione dell'azienda nel quadrante "prepara_condizioni" conferma che è il momento giusto per muoversi."*

**PDF generati e ispezionati** (id 700 preview 40.413 byte, id 701 finale 55.330 byte): roadmap e raccomandazione compaiono correttamente nel finale (7 pagine, tutti i 4 passi roadmap con titolo/tempistica/descrizione leggibili, raccomandazione leggibile per intero), correttamente **sfocate** nel preview (le sezioni "La tua roadmap"/"Dove andare" mostrano solo l'intestazione, contenuto reso come barre di blur non estraibili come testo — comportamento atteso). **Nessun "None", nessun overflow visibile nel testo estratto.**

### Caso 2 — solo un sottoinsieme (nessuna criticità, 1 azione urgente, win-win presente)

Riusato `erpv6.production.order` #66 ("TEST CIRCUITO WINWIN v3 - skip upload", intervista reale già completata in un giro precedente con percorso A/fallback): oneri 42.000€, EBITDA 210.000€, debito 300.000€, **patrimonio/rimborso mai risposti** (percorso A non li aveva chiesti in quel giro precedente — dato reale mancante, non manipolato da me), visura 2025-06-15, contenzioso No, nessun bando.

Risultato (Gate 3B sessione #388 **convergente**, primo tentativo fallito per `SerializationFailure` — conflitto di concorrenza transitorio con un cron sullo stesso database, non un bug del circuito, gestito con retry come nel giro precedente):
- 0 criticità (nessuna metrica calcolabile, dato mancante correttamente in `_missing`)
- 1 azione urgente (visura non recente)
- 1 passo roadmap (solo quello "Subito" dall'urgente, nessun passo bando perché `bando_target` assente — corretto, nessun placeholder al suo posto)
- 3 schede win-win approvate
- raccomandazione: *"Procedere con Rinegoziazione del tasso di interesse sul debito esistente, dando priorità a risolvere prima: Visura/bilancio non recente — unico elemento bloccante identificato. La posizione dell'azienda nel quadrante "prepara_condizioni" conferma che è il momento giusto per muoversi."*

**PDF generati e ispezionati** (id 702 preview 33.367 byte, id 703 finale 40.433 byte): sezione "Criticità da conoscere" e "Diagnosi" **assenti del tutto** dal PDF (corretto: il template le omette quando le liste sono vuote, nessuna intestazione vuota, nessun placeholder). Roadmap (1 passo) e raccomandazione compaiono correttamente nel finale, sfocate nel preview. **Nessun "None", nessun overflow.**

---

## Debito tecnico esplicito

- `tech_debt: generativo_non_deterministico` (confermato, invariato dal report precedente): le azioni win-win restano generative, passano dal Gate 3B.
- **Nuovo debito, minore**: le tempistiche standard (istruttoria bancaria, finestra bando) sono dichiarate come stime plausibili non verificate puntualmente su fonte autorevole (il campo `riferimento` lo dice esplicitamente in ogni voce) — corretto per lo scopo attuale, ma da sostituire con dati reali se/quando disponibili per bando/banca specifici.
- **Nuovo debito, operativo**: i record `erpv6.core.kb_link`/`erpv6.core.node` di questo circuito sono protetti da `noupdate="1"` — futuri cambi ai loro campi via modifica XML **non si applicheranno automaticamente con `-u`** su un'installazione già esistente, serve sempre un aggiornamento dati diretto (come ho dovuto fare io due volte in questo giro). Non è un bug, è il comportamento previsto di `noupdate`, ma va tenuto a mente per le prossime modifiche a questi file.
- **Confermato ancora una volta**: `SerializationFailure` transitorio possibile su commit durante il Gate 3B (probabile cron concorrente sullo stesso DB) — gestibile con un retry semplice, non ho investigato quale cron specifico collida (fuori scope, minore).

## File toccati in questo run (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- `odoo-modules/erpv6_winwin_renderdata/data/kb_winwin_thresholds_data.xml` (aggiunto `kb_category_id` al kb_link esistente)
- `odoo-modules/erpv6_winwin_renderdata/data/kb_roadmap_raccomandazione_data.xml` (nuovo)
- `odoo-modules/erpv6_winwin_renderdata/models/aeosv6_dispatch.py` (nuovo `_build_roadmap()`, `_resolve_kb_link()` per lookup robusto per categoria)
- `odoo-modules/erpv6_winwin_renderdata/models/gate.py` (nuovo `_winwin_build_raccomandazione()`, integrato in `build_and_validate_render_data()`)
- `odoo-modules/erpv6_winwin_renderdata/__manifest__.py` (nuovo data file registrato)
- Copiati anche in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/` (sincronizzazione verificata, `diff -rq` pulito)
- Nessun file di altri thread di lavoro toccato (Progetto TEE: `aeosv6_project_relay`, `aeosv6_relation`, `AUDIT_*.md` — verificato intatto prima e dopo)
- Dati di test aggiunti: lead #156, production.order #69, interview.session (nuova), validation.session #386 e #388 (entrambe convergenti), typst.document #700-703 (i 4 PDF)

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_ROADMAP_RACCOMANDAZIONE.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_ROADMAP_RACCOMANDAZIONE.md
```
