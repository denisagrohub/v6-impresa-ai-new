# Circuito `erpv6_winwin_renderdata` — Report (BLOCCATO in Fase 2)

Branch dedicato: `feature/circuito-winwin-renderdata` (locale, non pushato). Lavoro eseguito: **Fase 1 completa e verificata dal vivo. Fase 2 bloccata da un fatto che contraddice un'assunzione del prompt — non ho improvvisato una soluzione diversa, mi fermo qui come da istruzione.**

---

## Cosa ho costruito (Fase 1 — Conoscenza: soglie metriche)

Nuovo modulo Odoo `erpv6_winwin_renderdata`, installato e verificato live nel container `odoo` (db `erpv6`):

- `odoo-modules/erpv6_winwin_renderdata/__manifest__.py`
- `odoo-modules/erpv6_winwin_renderdata/__init__.py`
- `odoo-modules/erpv6_winwin_renderdata/models/__init__.py`
- `odoo-modules/erpv6_winwin_renderdata/models/aeosv6_dispatch.py`
- `odoo-modules/erpv6_winwin_renderdata/data/kb_winwin_thresholds_data.xml`

(copiati anche in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/`, stesso schema di sincronizzazione già in uso in questa sessione)

**Contenuto**:
1. `erpv6.kb.category` "Soglie Metriche Finanziarie (Win-Win)" — dato puro.
2. `erpv6.kb` "Soglie Win-Win — DSCR e Leva Finanziaria" (`content_format='json'`), con le bande verde/ambra/rosso + riferimento per DSCR e leva finanziaria, esattamente nel formato specificato nel prompt.
3. Nodo `erpv6.core.node` "Circuito Win-Win RenderData" nel grafo AEOSv6 (sotto `erpv6_core_engine.circuit_workspace_root`), con un nodo figlio "Costruisci render_data Win-Win" (`process_key='winwin_renderdata_build'`).
4. `erpv6.core.kb_link` (`resolution_mode='fixed_kb'`) che collega il nodo alla KB soglie — stesso pattern esatto già usato da `erpv6_disc_assessment` (confermato in Fase 0), nessun nuovo modello creato.

**Verificato dal vivo** (non solo scritto, eseguito):
```
modulo: erpv6_winwin_renderdata installed
nodo: Costruisci render_data Win-Win (BLOCCATO) process_key: winwin_renderdata_build
kb risolta: Soglie Win-Win — DSCR e Leva Finanziaria
contenuto soglie: {'dscr': {...}, 'leva_finanziaria': {...}}
```

## Perché mi sono fermato — la contraddizione trovata

Il prompt (Fase 2) assume che il Motore possa leggere "fatturato, oneri finanziari, EBITDA, debito finanziario, data ultima visura, contenzioso in corso, bando target, settore, forma giuridica" da `erpv6.interview.answer`/`erpv6.production.order`, più eventualmente "dati bilancio/finanziari raccolti (se presenti — vedi audit Fase 0 sul percorso A/B già discusso: upload documento vs domande dirette)".

**Ho verificato che questo non è vero, con tre controlli diretti:**

1. `erpv6.production.order` ha SOLO questi campi da intervista: `interview_score, interview_package_hint, interview_budget, interview_tempistiche, interview_tipo_progetto, interview_destinatario, interview_fatturato`. Nessun campo per oneri finanziari, EBITDA, debito finanziario, data ultima visura, contenzioso, bando target, forma giuridica.
2. I `field_key` realmente definiti nelle domande d'intervista sono solo: `budget, destinatario, fatturato, tempistiche, tipo_progetto`. Nessuna domanda su bilancio/EBITDA/DSCR esiste.
3. `interview_fatturato` — l'unico campo vagamente finanziario che esiste — contiene **fasce testuali** (verificato sui dati reali: `'< 1M€'`, `'5M€ - 10M€'`), non un numero utilizzabile per calcolare DSCR o leva finanziaria.
4. Il "percorso A/B (upload documento vs domande dirette)" citato nel prompt come "già discusso" **non esiste nel codice**: ho cercato "bilancio"/"DSCR"/"EBITDA" in tutto `odoo-modules/` — zero risultati. Deve essere stato discusso in una conversazione con l'utente mai tradotta in implementazione (o in un altro documento non presente in questo repo).

**Perché non ho improvvisato**: costruire il Motore comunque avrebbe richiesto una di queste due scelte non autorizzate dal prompt: (a) inventare/stimare valori di bilancio non disponibili — vietato esplicitamente ("mai un default silenzioso... mai inventare un valore quando manca il dato"); oppure (b) inventare di mia iniziativa nuove domande d'intervista con questi field_key, una decisione di prodotto reale (cosa chiedere a un imprenditore, come, con quali fasce/formato) che non mi compete prendere da solo.

Ho invece registrato il nodo del Motore nel grafo con un `process_key` che **fallisce esplicitamente** se invocato (verificato dal vivo: `UserError` con messaggio chiaro), invece di lasciarlo assente o farlo restituire un risultato finto — coerente col principio "mai un successo simulato" del progetto.

## Le tre opzioni per sbloccare (decisione dell'utente, non mia)

| Opzione | Cosa comporta |
|---|---|
| **A — Estendere l'intervista** | Aggiungere domande reali per oneri finanziari/EBITDA/debito/data visura/bando target come nuovi `field_key`, con formato numerico utilizzabile (non fasce testuali come oggi per `fatturato`). Tocca `erpv6_production/interview_engine.py` + il frontend `InterviewTreeFlow.tsx` + la definizione delle domande (dato KB o XML, da vedere). |
| **B — Upload documento bilancio** | Costruire per davvero il "percorso B" citato nel prompt: upload di un bilancio/visura, estrazione dati (via AI o parsing strutturato) verso gli stessi campi. Più lavoro, più affidabile su aziende con bilanci depositati. |
| **C — Ridurre lo scope della Fase 2** | Il Motore classifica solo su ciò che l'intervista raccoglie già oggi (budget, tempistiche, fatturato a fasce, settore) — niente DSCR/leva reali finché non c'è dato numerico. Criticità/azioni urgenti diventerebbero più generiche (es. basate su fasce fatturato, non su indici di bilancio veri). |

Nessuna di queste è "la strada di minor attrito" ovvia — è una decisione di prodotto, non tecnica, quindi la lascio all'utente.

## Fasi 3, 4, 5

**Non affrontate**: dipendono tutte dall'output del Motore (Fase 2), che non esiste. Nessun lavoro fatto lì, nessuna scrittura tentata su `erpv6.validation`, nessuna modifica al frontend Next.js, nessun test email/pagamento. Falso sarebbe dire "in parte fatte" — semplicemente non si può costruire un gate su un render_data che non viene prodotto.

## Debito tecnico esplicito richiesto dal prompt

`tech_debt: generativo_non_deterministico` — confermato dalla Fase 0: le azioni win-win restano generative via `_run_metodo_ai('winwin')`, mai passate da `erpv6.validation` oggi. Questo resta vero indipendentemente dal blocco sopra, ma non ho potuto costruire il Gate 3B attorno perché non c'è ancora nessun `RenderDataFinal` a cui agganciarlo.

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE_BLOCCATO.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE_BLOCCATO.md
```

## File toccati in questo run (branch `feature/circuito-winwin-renderdata`, nessun commit fatto, nessun push)

- Nuovo modulo: `odoo-modules/erpv6_winwin_renderdata/` (5 file, elencati sopra), copiato anche in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/`
- Nuovo report: `CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE_BLOCCATO.md` (questo file)
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima e dopo: le modifiche non committate preesistenti di Progetto TEE restano intonse)
