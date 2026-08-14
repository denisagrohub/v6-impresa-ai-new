# Typst → Gateway → Frontend: analisi pre-migrazione (Opzione A)

Solo analisi e test. Nessuna modifica al codice frontend. Un test reale è stato eseguito contro il database Odoo di staging (`erpv6`) e i dati di prova creati sono stati rimossi al termine (vedi FASE 1).

**Obiettivo Opzione A** (per memoria): Typst genera documenti lato Odoo (`erpv6_typst`, produzione); il frontend smette di usare Carbone e chiama il gateway.

---

## ⚠️ Scoperta trasversale che condiziona tutte le fasi seguenti

**Il codice in `odoo-modules/erpv6_typst/` (git, questo repo) e il codice realmente installato in produzione (`/opt/erpv6/custom-addons/erpv6_typst/`) sono due implementazioni completamente diverse dello stesso modulo, con lo stesso numero di versione (`18.0.1.0.0`).**

| | Git (`odoo-modules/erpv6_typst`) | Produzione (`/opt/erpv6/custom-addons/erpv6_typst`) |
|---|---|---|
| Modello documento | `erpv6.typst.document` con campo `pdf_file` | `erpv6.typst.document` con campo `file_content` |
| Modello template | `erpv6.typst.template` con `code`, `category`, `kb_id` (sorgente `.typ` criptato in KB) | `erpv6.typst.template` con `template_type`, `template_content` (testo semplice, **non** in KB) |
| Metodo di generazione | `action_render()` | `action_generate()` → `erpv6.typst.engine.generate_document()` |
| Chiama davvero il binario `typst`? | **No.** Codice commentato (`# response = requests.post(...)`), poi `# Simulazione successo`: imposta `status='ready'` e non tocca mai `pdf_file`. Verificato leggendo `models/typst_template.py:202-238`. | **Sì.** `_generate_pdf_with_typst()` in `typst_document.py` fa `subprocess.run(['typst','compile', file.typ, file.pdf])` e scrive il risultato in `file_content`. |
| Motore separato `erpv6.typst.engine` | Non esiste | Esiste (`typst_engine.py`), con `check_typst_installed()` che fa solo `typst --version` |

**Perché è rilevante ora**: `promote_module.sh` non confronta il contenuto, solo lo stato di installazione in `ir_module_module` (installed/to upgrade → `-u`). Eseguire oggi `./promote_module.sh erpv6_typst` **sovrascriverebbe silenziosamente l'implementazione funzionante in produzione con lo stub che non genera mai un PDF reale** — una regressione totale della funzionalità, senza errori visibili (lo stub segna comunque `status='ready'`). Prima di qualsiasi lavoro sull'Opzione A, i due sorgenti vanno riconciliati: o si allinea `odoo-modules/erpv6_typst` alla versione realmente funzionante in produzione, o si porta consapevolmente in produzione la versione git (che oggi *non* funziona, essendo uno stub) — ma non va promosso il modulo così com'è.

---

## FASE 1 — Verifica end-to-end reale (test eseguito su database `erpv6`, staging)

Test eseguito via `docker compose exec odoo odoo shell -c /etc/odoo/odoo.conf -d erpv6 --no-http` contro il codice **realmente installato** in produzione (quello con `action_generate()`, non lo stub git).

Passi:
1. Creato un `erpv6.typst.template` di prova (`template_type='custom'`, contenuto Typst minimo con placeholder `{{ partner.name }}` / `{{ document.date }}`).
2. Creato un `erpv6.typst.document` collegato al template, con `data` JSON di prova.
3. Chiamato `doc.action_generate()`.

**Risultato reale** (non un riassunto — output effettivo dello shell Odoo):
```
RENDER_OK status=generated file_size=11312 file_name=AUDIT-TEST-DOC-DELETEME.pdf
REAL_PDF_BYTES=11312
PDF_MAGIC=b'%PDF-'
```

Il file è stato estratto dal container (`docker cp`) e verificato con `file`:
```
audit_test_typst.pdf: PDF document, version 1.7, 1 page(s)
```

**Conclusione FASE 1**: la pipeline `template Typst → subprocess typst compile → PDF binario salvato su file_content` **funziona davvero** in produzione, con la versione del codice attualmente deployata (non con quella in git). File PDF reale di 11.312 byte, non un placeholder, non solo un flag di stato. `check_typst_installed()` (che testa solo `--version`) sottostimava la copertura reale: il binario non solo risponde, ma compila correttamente input reali.

Pulizia post-test: record `AUDIT-TEST-TEMPLATE-DELETEME` (id 4) e `AUDIT-TEST-DOC-DELETEME` (id 1) rimossi da `erpv6` con `unlink()` e commit; file temporaneo nel container rimosso.

---

## FASE 2 — Il gateway espone già questo?

**No, in nessuna delle due versioni del gateway esistenti.**

- Report di ieri (`docs/api-gateway-audit-2026-08-12.md`, FASE B): `erpv6_typst` è elencato esplicitamente tra i **"Moduli con propria API diretta ma MAI richiamati dal gateway"** — riga 110: *"`erpv6_typst` (`/api/v6/typst/*` completo, gateway assente)"*. Confermato, nessuna riga di quel report attribuisce a `erpv6_typst` una rotta nel gateway.
- Verifica diretta sul codice: `grep -rl "typst" odoo-modules/erpv6_api_gateway/` → nessun risultato. Nessuno dei 19 file controller (versione git) menziona `typst`.

**Scoperta aggiuntiva non richiesta ma rilevante per la Fase 4**: anche `erpv6_api_gateway` ha uno scarto dev/produzione, come `erpv6_typst`:

| | Git (`odoo-modules/erpv6_api_gateway`, v18.0.**2**.0.0) | Produzione (`/opt/erpv6/custom-addons/erpv6_api_gateway`, v18.0.**1**.0.0) |
|---|---|---|
| Controller presenti | 19 file: `accounting_api`, `ai_api`, `bandi_api`, `booking_api`, `file_api`, `kb_api`, `lead_api`, `library_api`, `main`, `methodology_api`, `partner_api`, `project_api`, `saas_api`, `saas_tenant_api`, `saas_vertical_api`, `sign_api`, `tracking_api`, `user_api`, `validation_api` | 5 file: `ai_api`, `booking_api`, `kb_api`, `lead_api`, `main` |
| `ai_api.py` | Delega correttamente a `erpv6_omni_bridge` (fix già presente in git) | Versione precedente, ancora con il bug "modello inesistente" descritto nel report di ieri |

Il report di ieri (FASE A/B) descriveva quindi **il gateway *futuro* (git), non quello attualmente in esercizio**. Su `erpv6` in produzione oggi sono raggiungibili solo `ai`, `booking`, `kb`, `lead`, e `health` — non `accounting`, `bandi`, `saas`, `sign`, `tracking`, `validation`, ecc., indipendentemente da `erpv6_typst`.

**Implicazione per l'Opzione A**: aggiungere una rotta `typst` al gateway richiede non solo scrivere il controller, ma anche promuovere l'intero modulo `erpv6_api_gateway` (git → produzione) — un cambio più ampio della sola aggiunta di una rotta, da valutare a parte per non introdurre in produzione anche le altre 14 rotte non ancora testate lì.

---

## FASE 3 — Dove vive Carbone nel frontend oggi

Ricerca (`grep -rIni "carbone"`) su tutto l'albero `src/` (Next.js, root del repo — non esiste una cartella `apps/` in questo checkout, a differenza di quanto descritto in CLAUDE.md; l'app Next.js vive direttamente in `src/`).

**Risultato: un solo punto d'uso, e non è nemmeno una vera chiamata alla libreria Carbone.**

| File | Funzione/riga | Cosa fa |
|---|---|---|
| `src/app/consultant/project-progress/ProjectProgressContent.tsx` | `exportForCarbone()` (righe 190-201), collegata al bottone "📥 Carbone.io" (riga 306-307) | Costruisce un oggetto JSON lato client (executive summary, diagnostica Kairós, stato "6 aree" del progetto), lo serializza e forza il download nel browser come `carbone-payload-{project.id}.json`. **Nessuna chiamata di rete, nessuna generazione di documento** — è un export manuale del payload, presumibilmente pensato per essere caricato a mano in Carbone.io (servizio esterno) da un operatore umano. |

Genera il payload per: un **Business Plan** (il JSON include `executive_summary`, `diagnostica_v6.kairos_score/livello/quadrante`, `sei_aree_val`).

**Il pacchetto npm `carbone` (`"carbone": "^3.8.2"` in `package.json`) non viene importato da nessun file `.ts/.tsx/.js/.jsx` nel repo** (`grep` mirato su `from 'carbone'` / `require('carbone')`: zero risultati). È una dipendenza dichiarata ma morta — non genera nulla lato server oggi.

Nessun altro punto del frontend (route API, componenti) fa riferimento a Carbone, sotto qualunque forma.

---

## FASE 4 — Piano di sostituzione (proposta, non applicata)

### 4.1 — Cosa dovrebbe esporre il gateway per `erpv6_typst`

Non esiste oggi nessuna rotta gateway da modificare: va creato un nuovo file controller, es. `odoo-modules/erpv6_api_gateway/controllers/typst_api.py`, seguendo lo stesso pattern di `booking_api.py`/`kb_api.py` (gli unici due già promossi in produzione insieme a `main`/`ai`/`lead`, quindi il pattern "sicuro" da replicare).

Proposta minima (3 rotte, calcate su ciò che serve realmente al frontend, non su tutto ciò che il modulo espone):

| Path | Metodo | Input atteso | Output |
|---|---|---|---|
| `/api/v1/documents/generate` | POST | `{ template_type, res_model, res_id, data: {...} }` (stessa forma di `_render_template`/`action_generate` in produzione) | `{ document_id, status, file_size }` — sincrono, dato che il test in FASE 1 ha impiegato meno di un secondo per un documento minimo; da confermare i tempi su un vero Business Plan multi-pagina prima di assumere che resti sincrono |
| `/api/v1/documents/<id>/status` | GET | — | `{ status, file_size, file_name }` |
| `/api/v1/documents/<id>/download` | GET | — | redirect o proxy binario verso `/web/content/erpv6.typst.document/<id>/file_content/<file_name>?download=true` (route Odoo nativa già esistente per i campi Binary con `attachment=True`) |

Punto da decidere esplicitamente, non da assumere: se il target è la versione **produzione** di `erpv6_typst` (quella verificata funzionante in FASE 1), il controller deve chiamare `env['erpv6.typst.engine'].generate_document(template_id, res_model, res_id, data)` e i nomi campo corretti sono `file_content`/`file_name`/`file_size` — **non** `pdf_file`/`pdf_filename` come nel report di ieri (che descriveva la versione git/stub).

### 4.2 — Cosa cambia per il punto d'uso di Carbone trovato in Fase 3

Un solo punto da modificare: `exportForCarbone()` in `ProjectProgressContent.tsx`.

| Oggi | Con gateway |
|---|---|
| Costruisce JSON lato client, forza download nel browser, nessuna generazione | Chiama `gatewayPost('documents', { template_type: 'business_plan', res_model: 'crm.lead', res_id: project.id, data: {...stesso payload già costruito oggi...} })`, poi fa polling di `/status` (o riceve subito l'esito se sincrono) e scarica il PDF vero da Odoo invece del JSON grezzo |
| Bottone "📥 Carbone.io" scarica un `.json` | Bottone dovrebbe diventare "Genera Business Plan (PDF)" e scaricare un `.pdf` |

Serve anche: aggiungere una voce `documents` a `GATEWAY_SCHEMA` in `src/lib/gateway-schema.ts` (oggi assente — verificato, nessuna feature esistente copre generazione documenti) con `odooEndpoint: '/api/v1/documents/generate'`.

Il pacchetto npm `carbone` in `package.json` può essere rimosso a prescindere dall'esito di questa migrazione: non è mai importato, non è codice da "sostituire", è dead weight.

### 4.3 — Sequenza consigliata (solo proposta)

1. Riconciliare `odoo-modules/erpv6_typst` con la versione funzionante in produzione (§ "Scoperta trasversale") — senza questo, qualunque `promote_module.sh erpv6_typst` futuro rompe la produzione.
2. Scrivere `typst_api.py` nel gateway (git), puntando ai nomi campo/metodi reali di produzione.
3. `./promote_module.sh erpv6_api_gateway erpv6_typst` (dopo il punto 1) e verificarne l'esito con l'output reale dello script, non un riassunto.
4. Aggiungere la feature `documents` a `gateway-schema.ts` e collegare `exportForCarbone()`.
5. Solo a questo punto rimuovere la dipendenza `carbone` da `package.json`.

Nessuno di questi passi è stato eseguito in questa sessione oltre al test di lettura/verifica in FASE 1 (dati di test creati e rimossi).
