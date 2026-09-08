# Trigger progetto + Dashboard consulente + Email per-progetto — FASE 0 (verifica, sola lettura)

Verifica eseguita il 2026-09-06, branch `feature/circuito-winwin-renderdata` (nessuna scrittura). Continua da `CIRCUITO_WINWIN_RENDERDATA_BOOKING.md`.

---

## 1. `erpv6.production.order` è già "il progetto"?

**Sì, confermato** — è la stessa entità già usata in tutto questo circuito (Motore, Gate, render_data, booking). Etichetta UI reale: azione "Produzioni" (`action_production_order`, `views/production_views.xml`), `_description = 'Produzione in corso (relazione, business plan, ...) collegata a un lead'`. Nessun modello nuovo serve per "il progetto": `erpv6.production.order` + il suo `lead_id` collegato bastano.

## 2. Pattern OWL della dashboard TEE

**Non esiste — verificato, non presunto.** Cercato in tutto `odoo-modules/aeosv6_project_relay/` e `aeosv6_relation/`: zero file `.js`, zero `@odoo-module`, zero componenti OWL. L'unico file sotto `static/` è l'icona PNG dell'app (`aeosv6_relation/static/description/icon.png`). Le viste TEE (`Progetti`, `Relazioni`, `Email Progetti`) sono liste/form Odoo **standard** (XML `<list>`/`<form>`), nessun kanban custom, nessun widget dashboard. Cercato anche a livello di intero repo un pattern OWL generico riusabile: trovate solo patch JS di `erpv6_whitelabel` (branding UI nativa Odoo — notifiche, menu utente), non pertinenti.

**Conseguenza per la Fase 2**: non c'è nulla da riusare/adattare per l'aspetto grafico — la dashboard consulente andrebbe costruita con viste Odoo standard (list/kanban/form, eventualmente un dashboard XML con più azioni) a meno che non si voglia essere i primi a introdurre OWL in questo progetto. Il principio di riuso resta rispettato: nessuna duplicazione, perché semplicemente non c'era nulla di OWL da duplicare.

## 3. Credenziali IMAP `catchall@v6impresa.it`

**Funzionano, verificato con una connessione reale**: `imap.register.it:993` SSL, login riuscito, INBOX vuota (0 messaggi, atteso per una casella nuova). Stesso host di `catchall@v6sviluppoimpresa.it` (TEE) ma dominio distinto — confermato non confuso.

**Ma nulla è ancora collegato in Odoo**: `fetchmail.server` ha oggi **solo** la voce TEE (`catchall@v6sviluppoimpresa.it`, id 2) — nessun server IMAP configurato per `v6impresa.it`. Stesso per l'uscita: `ir.mail_server` ha Register.it (per TEE, `from_filter='v6sviluppoimpresa.it'`) e Brevo (condiviso con Documenso, **`from_filter` non impostato** — non è già ristretto al dominio `v6impresa.it`). La Fase 1 dovrà creare da zero sia il `fetchmail.server` sia, se serve inviare da un alias per-progetto, un `ir.mail_server`/`from_filter` per `v6impresa.it` (stesso schema già fatto per TEE, non un meccanismo nuovo — ma va creato, non esiste già).

## 4. Campi disponibili per un lead con intervista Win-Win completata

Verificato su `erpv6.production.order` #69 (caso reale già usato nei giri precedenti):

- **BANT**: tutti campi diretti, query semplice, nessun join — `interview_budget`, `interview_tempistiche`, `interview_tipo_progetto`, `interview_destinatario`, `interview_fatturato` (+ `_esatto`), più i campi bilancio aggiunti nel circuito (`interview_oneri_finanziari`, `interview_ebitda`, `interview_debito_finanziario`, `interview_patrimonio_netto`, `interview_rimborso_capitale_annuo`, `interview_data_ultima_visura`, `interview_contenzioso_in_corso`, `interview_bando_target`).
- **render_data completo (diagnosi, criticità, azioni urgenti, schede win-win, roadmap, raccomandazione, quadrante, consultant_booking_id)**: **un solo campo**, `production_order.winwin_render_data_final` (tipo `Json` nativo Odoo) — contiene TUTTO già assemblato e validato dal Gate. La dashboard può leggere quasi tutto da qui con zero join, se il render_data è già stato generato per quel caso.
- **Kairós — attenzione, non è 1:1 come sembra**: `erpv6.kairos.matrix` per lo stesso `production_order.id` risultano **11 righe** (accumulate dai re-run ripetuti nei giri di test di questo stesso circuito) — un `search()` semplice senza `order='id desc', limit=1` restituisce un recordset multiplo e fa esplodere qualunque `.campo` che assume un singolo record (verificato: `ValueError: Expected singleton`). La query giusta è sempre con `order_by`+`limit=1`, mai un `search()` nudo.
- **Token booking**: `erpv6.winwin.report.token` per `production_order_id` — query diretta, semplice.

**Gap reale trovato, rilevante per la Fase 1**: `erpv6.booking.token` (2 record reali con `status='booked'`, dati cliente compilati: "Mario Rossi Test", "Prospect Test") **non ha nessun campo che lo colleghi a un lead/production_order**. Oggi non esiste modo di sapere "questo token prenotato viene dal report Win-Win di quale progetto" — la Fase 1 dovrà aggiungere questo collegamento (nuovo campo su `erpv6.booking.token`, es. `lead_id`/`production_order_id`), non è già lì.

---

## Riepilogo per la Fase 1

| Punto | Stato |
|---|---|
| Modello "progetto" | Già esiste (`erpv6.production.order`), riuso diretto |
| Dashboard OWL da riusare | Non esiste — da costruire con viste Odoo standard |
| IMAP `catchall@v6impresa.it` | Credenziali valide, ma nessun `fetchmail.server`/`ir.mail_server` ancora configurato per questo dominio |
| Dati BANT/render_data | Quasi tutto in 1-2 campi diretti; Kairós richiede `order_by`+`limit=1`, mai `search()` nudo |
| Collegamento token→progetto | Manca, va aggiunto in Fase 1 |

Nessuna scrittura effettuata. In attesa di conferma prima di procedere alla Fase 1.

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_TRIGGER_DASHBOARD_FASE0.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_TRIGGER_DASHBOARD_FASE0.md
```
