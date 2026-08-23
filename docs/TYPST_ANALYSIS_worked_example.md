# Typst / Template / Intervista / Prodotti — stato reale verificato il 22/08/2026

Documento equivalente, per il dominio Typst, a
`docs/KAIZEN_rule_application_worked_example.md` — richiesto come prerequisito
per costruire l'agente "Andrea" (vedi Compito 2 della stessa sessione). Tutti
i numeri sotto vengono da query dirette sul database `erpv6` (staging, mai
`fattorie_della_fenice`), eseguite ora, non riusati da conversazioni
precedenti — stessa disciplina già imposta a Kaizen (Regola 4, "dati e fatti,
non opinioni").

## 1. Quanti template esistono, quanti hanno `typst_source` vuoto

Query reale: `SELECT count(*) FROM erpv6_typst_template;` e lettura riga per
riga.

**11 template totali**, **7 con `typst_source` vuoto**:

| id | code | categoria | `typst_source` |
|---|---|---|---|
| 1 | NDA-BASE-001 | business_plan | **vuoto** |
| 2 | BP-BASE-001 | business_plan | **vuoto** |
| 3 | CONTRACT-SVC-001 | business_plan | **vuoto** |
| 5 | BP-STD-001 | business_plan | **vuoto** |
| 6 | FR-QTR-001 | financial_report | **vuoto** |
| 7 | BA-PNRR-001 | bando_application | **vuoto** |
| 8 | PROP-L2-001 | proposal | **vuoto** |
| 9 | INTERVISTA-REPORT-001 | custom | presente (interno) |
| 11 | KB-EXTRACT-REPORT-001 | custom | presente (interno) |
| 12 | KB-VALID-CERT-001 | custom | presente (interno) |
| 13 | KB-PENDING-REVIEW-001 | custom | presente (interno) |

Gli id 4 e 10 non esistono più (cancellati/mai creati) — la sequenza reale
salta da 3 a 5 e da 9 a 11. I 4 template con sorgente reale sono tutti e soli
i template "interni" (report generati dal sistema stesso: intervista,
resoconto estrazione KB, certificato 6 Giudici, resoconto pre-approvazione).
**Nessuno dei 7 template client-facing (business plan, NDA, contratto,
report finanziario, candidatura bando, proposta commerciale) ha oggi un
sorgente Typst reale.**

Questo conferma esattamente il numero già usato nel worked example Kaizen
(11/7) — riverificato ora, non riusato per fiducia.

`required_fields`: i template **1, 2, 3** hanno `required_fields` NULL. Con
zero `erpv6.package.module` esistenti nel sistema (vedi sezione 4), questi 3
template **non hanno oggi nessuno schema campi disponibile, né sul template
né su un modulo collegato** — il motore bozza (sezione 3) si bloccherebbe con
`UserError` esplicito se lanciato su di loro, non genererebbe nulla a caso.

## 2. Un caso reale e attivo di blocco in produzione — template #8

Query reale su `erpv6_typst_document` (documenti generati dal motore di
rendering):

- **350 documenti in stato `failed`** collegati al template #8
  (PROP-L2-001, "Proposta Commerciale L2"), dal **20/08/2026 08:01:18** al
  **22/08/2026 21:00:52** (ancora in corso al momento di questa verifica).
- Errore identico su tutti: `"Template non configurato: manca il sorgente
  Typst (Proposta Commerciale L2)."` — sollevato da
  `erpv6.typst.template.get_typst_source()` (`odoo-modules/erpv6_typst/models/typst_template.py:106-112`).
- Distribuiti su 3 `erpv6.production.order` reali: **#7 (116 tentativi), #21
  (117), #22 (117)** — un cron interno tenta il rendering ripetutamente
  (cadenza ~30 minuti) e fallisce ogni volta, da oltre due giorni.

**La cosa più rilevante trovata in questa verifica**: il motore bozza AI
(sezione 3) **è già stato eseguito con successo su questo esatto template**
— `typst_draft_generated_at = 2026-08-21 19:07:06`,
`typst_draft_compile_ok = true`, `typst_draft_unknown_fields` vuoto (nessun
campo sospetto), una bozza reale è presente in `typst_source_draft`. Da quel
momento (oltre 24 ore prima di questa verifica) **nessuno ha eseguito
`action_promote_draft_to_source`** — la bozza, già compilabile, resta ferma
in attesa del gate umano finale mentre il sistema continua a generare
fallimenti automatici ogni mezz'ora. Questo è il caso concreto, non
ipotetico, che ha motivato la scrittura di `action_promote_draft_to_source`
(vedi commento in testa a `erpv6_production/models/typst_template.py`), ma
il gate non è ancora stato azionato da un umano.

## 3. Come funziona il motore bozza (AI genera → verifica → gate umano)

Definito in `odoo-modules/erpv6_production/models/typst_template.py`
(estende `erpv6.typst.template`, non può vivere in `erpv6_typst` perché
dipende da `erpv6_omni_bridge`, altrimenti ciclo di dipendenze).

1. **`action_generate_typst_source_draft()`** (gate di ingresso, click
   umano): risolve lo schema campi (`_resolve_required_fields` — prima il
   template stesso, poi un `erpv6.package.module` collegato via
   `typst_template_id`), cerca un sorgente `.typ` reale esistente come
   few-shot (`_find_typst_few_shot_source`, preferendo stessa categoria) e,
   se il template nasce da un caso studio, il testo del documento originale
   come contesto di stile (`_find_case_study_source_text`). Chiama l'AI
   (`omni.bridge`, task `typst_source_generation`) con un prompt che vieta
   esplicitamente campi non presenti nello schema. Scrive **solo**
   `typst_source_draft`, mai `typst_source`.
2. **Compilazione di verifica, subito, prima che un umano la veda**:
   `_typst_compile_check` compila DAVVERO la bozza con lo stesso binario
   `typst` usato in produzione, su dati fittizi derivati dallo schema, in
   una directory temporanea isolata — non tocca mai un documento reale.
   Risultato in `typst_draft_compile_ok`/`typst_draft_compile_error`.
3. **Controllo campi inventati**: `_static_check_unknown_fields` — controllo
   deterministico (non affidato all'AI), estrae le chiavi lette con
   `data.at("...")` nel sorgente e segnala quelle assenti da
   `required_fields` in `typst_draft_unknown_fields`.
4. **Gate umano**: un'attività to-do viene assegnata al supervisore (lead
   fisso "Amministrazione KB"), che revisiona/corregge il campo `typst_source_draft`
   a mano se serve.
5. **`action_promote_draft_to_source()`** (gate finale): **ricompila di
   nuovo, ora**, indipendentemente dall'esito salvato al passo 2 (la bozza
   potrebbe essere stata corretta o rotta a mano nel frattempo) — se non
   compila, blocca la promozione con `UserError`. Solo se compila copia
   `typst_source_draft` → `typst_source`: da quel momento
   `action_render()` (motore di rendering reale) userà quel sorgente.

Nessuna promozione avviene mai in automatico: il motore genera solo bozze,
ogni passaggio a sorgente reale richiede un click umano esplicito — anche
quando (come per il template #8, sezione 2) la bozza è già verificata
compilabile.

## 4. Documenti caso studio #27 e #33 — mai confermati

Query reale su `erpv6_library_document` (categoria `kb_case_study`):

| id | nome | tipo di lavoro | `case_study_match_status` | modulo suggerito | motivazione AI |
|---|---|---|---|---|---|
| 27 | Business plan | business_plan | `suggested_new` | (nessuno) | *(vuota)* |
| 33 | Memorandum | business_plan | `suggested_new` | (nessuno) | *(vuota)* |

Entrambi sono gli **unici due** documenti `kb_case_study` presenti nel
sistema oggi. L'AI (`action_check_existing_template_match`, route
`kb_case_study_match`) ha concluso per entrambi `suggested_new` (nessun
template/modulo esistente compatibile all'~90%) — coerente con il fatto che,
verificato ora, **`erpv6.package.module` ha zero record in tutto il
sistema** (`SELECT count(*) FROM erpv6_package_module;` → `0`), quindi non
esisteva alcun candidato da confrontare per nessuno dei due documenti.

`case_study_match_reasoning` è **vuoto** per entrambi, nonostante il codice
(`library_document.py:622`) lo valorizzi sempre con
`parsed.get('reasoning', '')` quando la chiamata AI riesce — un valore vuoto
è comunque compatibile con una risposta AI ricevuta ma con motivazione
vuota/non fornita dal modello; non è possibile distinguere da qui, senza il
chatter del documento, se la chiamata sia fallita silenziosamente a monte di
quel campo o se l'AI abbia semplicemente restituito una stringa vuota —
segnalato come dato da verificare, non inventata una spiegazione.

**Nessuno dei due documenti ha mai ricevuto il gate umano finale**: né
`action_confirm_reuse_existing_template` (non applicabile, nessun match) né
`action_confirm_create_new_template` risultano eseguiti —
`case_study_match_status` è fermo a `suggested_new`, non `confirmed_new`, e
`case_study_generated_package_module_ids` è vuoto su entrambi. Confermato
anche indirettamente: se `action_confirm_create_new_template` fosse mai
stata eseguita anche una sola volta su uno dei due, esisterebbe almeno un
record in `erpv6.package.module` (la creazione della coppia
template+modulo è il primo effetto di quell'azione) — e quella tabella è
vuota. La trasformazione documento→template resta quindi bloccata al primo
gate umano per entrambi, mai avviata.

## 5. Dove sta il collegamento `erpv6.package.module` ↔ `erpv6.typst.template`

Campo diretto: `erpv6.package.module.typst_template_id` (Many2one verso
`erpv6.typst.template`, `odoo-modules/erpv6_package/models/package_module.py:29-32`).
`erpv6.package.module` porta anche `required_fields` (Json) e
`interview_questions` (Text) — lo schema campi/intervista vive sul modulo,
non (necessariamente) sul template.

Il collegamento è usato in tre punti reali del codice:

- `typst_template.py._resolve_required_fields()`: se il template non ha
  `required_fields` proprio, cerca un `erpv6.package.module` con
  `typst_template_id = self.id` e ne legge lo schema.
- `typst_template.py._find_case_study_source_text()`: risale dal template al
  modulo collegato, poi (via
  `erpv6.library.document.case_study_generated_package_module_ids`) al
  documento caso studio originale, per usarne il testo come contesto di
  stile nella generazione bozza.
- `library_document.py._create_template_interview_stub()`: crea **sempre
  insieme** la coppia `erpv6.typst.template` (stub, sorgente vuoto) +
  `erpv6.package.module` (con `typst_template_id` verso il template appena
  creato), popolando `required_fields`/`interview_questions` sul modulo se
  l'AI riesce a generarli dal testo del documento
  (`_generate_case_study_interview`) — mai sul template stesso.

Con zero `erpv6.package.module` esistenti oggi (sezione 4), questo
collegamento è **verificato nel codice ma non ancora popolato in nessun caso
reale** nel database attuale.

## 6. Riepilogo per Andrea (cosa deve sapere davvero)

- 11 template Typst totali, 7 senza sorgente reale (client-facing), 4 con
  sorgente reale (solo i report interni del sistema).
- Il template #8 ha una bozza AI già compilabile, ferma da oltre un giorno,
  che sta causando fallimenti ripetuti (~350 ad oggi) su 3 production order
  reali — un candidato concreto per un promemoria/azione di Andrea, sempre
  con conferma umana esplicita per la promozione, mai automatica.
- I template 1/2/3 non hanno nessuno schema campi disponibile (né proprio né
  via modulo collegato): il motore bozza non può generare nulla per loro
  finché `required_fields` non viene popolato da qualcuno.
- 2 documenti caso studio (#27, #33) sono fermi al primo gate umano
  (`suggested_new`, mai confermati) — zero moduli/template sono mai stati
  generati dal flusso caso-studio in tutto il sistema.
- Il collegamento template↔modulo passa sempre da
  `erpv6.package.module.typst_template_id`, mai il verso opposto.
