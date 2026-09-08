# Trigger progetto + Dashboard consulente + Email per-progetto — Report Fasi 1-3

Continua da `CIRCUITO_TRIGGER_DASHBOARD_FASE0.md`. Branch: `feature/circuito-winwin-renderdata` (scelto perché tutto il resto del circuito Win-Win vive già lì ed è collegato — un branch separato avrebbe richiesto comunque una dipendenza cross-branch scomoda). Nessun commit, nessun push.

**Stato: Fasi 1, 2, 3 completate e verificate dal vivo end-to-end, inclusa una vera email esterna captata nel feed. Un problema architetturale reale scoperto e documentato (non bloccante, aggirato correttamente nel test).**

---

## Riuso vs nuovo, con motivazione (come richiesto)

| Pezzo | Scelta | Perché |
|---|---|---|
| Modello "progetto" | Riuso `erpv6.production.order` | Confermato in Fase 0 |
| Arco consulente | Riuso `erpv6.tracking.relation` (modulo `aeosv6_relation`, già installato per TEE) | Richiesto esplicitamente dal prompt; modulo già live in questo ambiente, nessun rischio di installazione |
| Assegnazione consulente | Riuso `_set_delivery_consulente()`/`_auto_assign_consulente()` (`erpv6_production`) | Non toccata, non duplicata — solo chiamata |
| Notifica consulente | Riuso `erpv6.agent.communication.create_and_route()` | Stesso meccanismo già riusato in questo circuito per l'escalation Gate 3B |
| Fetchmail/SMTP per `v6impresa.it` | **Nuovo** (`fetchmail.server` + `ir.mail_server` id nuovi) | Confermato in Fase 0: non esisteva nulla per questo dominio |
| Modello email log | **Nuovo** (`erpv6.winwin.email.log`) | `aeosv6_project_relay.erpv6.project.email.log` (TEE) ha il regex dominio **hardcoded** su `v6sviluppoimpresa.it` e vive in un modulo non committato di un altro thread — non riusabile né modificabile. Riuso il *pattern* architetturale (alias su nodo radice, riconoscimento mittente sui figli), non il codice |
| Dashboard OWL | **Nuovo** (primo componente OWL del progetto, per istruzione esplicita dell'utente) | Confermato in Fase 0: nessun pattern preesistente |
| Collegamento token→progetto | **Nuovo** (`production_order_id`/`lead_id` su `erpv6.booking.token`) | Gap confermato in Fase 0 |

---

## Fase 1 — Trigger

### 1.1 Collegamento token→progetto (`models/booking_token_extension.py`)

Estende `erpv6.booking.token` (modulo `aeosv6_booking`) con `production_order_id`, `lead_id`, `presa_in_carico`. `gate.py._resolve_consultant_for_booking()` aggiornato: non basta più "un qualunque token disponibile del consulente" (la pagina `/booking/<id>` mostra TUTTI i token disponibili, un cliente potrebbe scegliere un token generico non legato a questo caso) — ora garantisce/crea un token **specificamente taggato** `production_order_id=self.id`. Creazione diretta (`Token.create()`, stesso costrutto interno di `generate_bulk()`, che non supporta campi extra e non ritorna il record) invece di `generate_bulk()` — non un meccanismo duplicato, la stessa identica scrittura con un campo in più.

### 1.2 `action_prendi_in_carico()`

Azione umana deliberata (bottone dashboard, mai un trigger automatico). Sequenza:
1. Risolve/crea il lead (per `lead_id` già noto se il token viene dal report Win-Win, altrimenti per `client_email`, altrimenti crea un `crm.lead` nuovo — copre anche il caso di un token generico creato dal consulente dalla propria dashboard, non solo quelli originati dal report).
2. Risolve/crea `erpv6.production.order` (creato solo ora, mai prima — "il progetto nasce quando il consulente dà OK").
3. `_set_delivery_consulente()` sul lead.
4. `_ensure_progetto_relation()`: crea l'Arco (nodo radice con alias email univoco `progetto-<slug>-<order_id>`, nodo figlio consulente con `ruolo='gestore'`).
5. Notifica via `erpv6.agent.communication`.

**Bug reale trovato e corretto durante il test dal vivo**: `assignment_reason` su `erpv6.production.consulente.line` è un `Selection` chiuso — il valore che avevo scelto (`'booking_preso_in_carico'`) non esisteva, `ValueError` reale intercettato. Corretto riusando `'sourcing_diretto'` ("Lead portato/creato direttamente dal consulente (dashboard)") — semanticamente il caso più vicino già previsto dal modello, non un nuovo valore aggiunto.

### 1.3 Email `catchall@v6impresa.it`

`fetchmail.server` (IMAP, `imap.register.it:993`) e `ir.mail_server` (uscita, `authsmtp.register.it:587`, `from_filter='v6impresa.it'`) creati e **testati dal vivo con connessione reale** (login IMAP OK, `test_smtp_connection()` OK) — stesso schema già usato per TEE, credenziali diverse/dominio diverso, mai confuse.

---

## Fase 2 — Dashboard OWL (primo pattern OWL del progetto)

### Struttura file (documentata come riferimento futuro, come richiesto)

```
odoo-modules/erpv6_winwin_renderdata/
  static/src/
    js/winwin_dashboard.js      componente OWL + registry.category("actions").add(...)
    xml/winwin_dashboard.xml    template QWeb/OWL (t-name = Component.template)
    scss/winwin_dashboard.scss  palette navy #0F1E3C / terracotta #D4703A / crema #F7F3ED
  views/winwin_dashboard_views.xml   <ir.actions.client tag="winwin_consultant_dashboard">
  __manifest__.py: 'assets': {'web.assets_backend': [...]}
```

Punti chiave per chi riuserà questo pattern:
- Un `ir.actions.client` (mai un `act_window`) con `tag` che deve combaciare **esattamente** la stringa passata a `registry.category("actions").add("<tag>", Component)`.
- Il componente chiama SOLO metodi ORM (`this.orm.call(model, method, args)`) — **endpoint dati separati dalla vista**, mai logica intrecciata nel componente: `erpv6.booking.token.get_richieste_in_arrivo()` e `erpv6.production.order.get_miei_progetti()`, entrambi `@api.model`, così un domani un frontend esterno (Next.js — "un motore, due presentazioni", stesso principio già applicato altrove) può chiamare la stessa logica senza duplicarla. **Fase futura, non costruita qui.**
- Per un metodo record-bound (non `@api.model`) chiamato da OWL, il primo elemento di `args` è la lista di id: `this.orm.call(model, "action_prendi_in_carico", [[tokenId]])` — dettaglio facile da sbagliare, verificato funzionante nel test end-to-end.

### Due viste

**Richieste in arrivo**: `get_richieste_in_arrivo()` filtra per `consultant_id` risolto da `env.user.partner_id` (solo le proprie), stato `booked` + `presa_in_carico=False`. Mostra nome/email/telefono/note cliente, quadrante Kairós e conteggio criticità **se il report è già stato generato** per quel caso (letti da `production_order.winwin_render_data_final`, zero query aggiuntive su Kairós — evita del tutto il rischio "Expected singleton" segnalato prima della Fase 1).

**I miei progetti**: `get_miei_progetti()` — BANT, quadrante, criticità/urgenti, stato report, alias email, feed email (ultime 20), stato DISC (placeholder "non_ancora_raccolto", come esplicitamente autorizzato dal prompt).

### ACL — nessun `ir.rule` nuovo, verificato perché

`erpv6.production.order` ha `perm_read=1` per `base.group_user` **senza nessun `ir.rule` che filtri per proprietario** (verificato nel CSV di sicurezza di `erpv6_production`) — quindi senza un filtro esplicito, qualunque utente interno vedrebbe i progetti di TUTTI i consulenti. Il filtro di sicurezza reale è il dominio esplicito `('lead_id.user_id', '=', self.env.user.id)` dentro il metodo stesso (valore letto lato server, mai passabile dal chiamante) — non un `ir.rule` nuovo. **Debito dichiarato**: questo rende il metodo stesso l'unico confine di sicurezza per questo caso d'uso — corretto per come è scritto oggi, ma fragile se qualcun altro aggiungesse in futuro un modo alternativo di leggere `production.order` dimenticando lo stesso filtro. Un `ir.rule` reale sarebbe più robusto a lungo termine.

---

## Fase 3 — Verifica end-to-end (dati reali, non payload scritti a mano)

Usato `erpv6.production.order` #71 (lead #158, caso reale già esistente con render_data generato).

1. `order._resolve_consultant_for_booking()` → token #6 creato, `production_order_id=71`, `lead_id=158`.
2. Simulata la prenotazione cliente reale (`token.action_book()` + dati cliente) — stato `booked`.
3. `get_richieste_in_arrivo()` chiamato **come l'utente Stefano Puglisi** (`with_user`) → il token compare in coda con quadrante "parcheggio" letto dal render_data.
4. `action_prendi_in_carico()` eseguito come Stefano → verificato dal vivo: `presa_in_carico=True`, Arco creato (nodo radice "Progetto TEST WEB ASYNC E2E 2", alias `progetto-test-web-async-e2e-2-71`, nodo figlio "Stefano Puglisi" ruolo `gestore`), notifica `erpv6.agent.communication` creata e instradata (`sent_via_susanna`).
5. **Email di progetto**: primo tentativo di test fallito per un motivo architetturale reale (vedi sotto), risolto e **riverificato con successo**: email esterna reale via SMTP a `progetto-test-web-async-e2e-2-71@v6impresa.it` → fetchmail la cattura → `erpv6.winwin.email.log` id 1, `match_status='matched'`, `relation_id=11` (corretto) → **confermata visibile nel feed di `get_miei_progetti()`**.

### Scoperta architetturale reale (non un bug del mio codice, un vincolo di Odoo)

**Non si può testare il fetch email mandando un'email tramite `mail.mail`/`ir.mail_server` di Odoo verso un indirizzo che Odoo stesso poi va a leggere via IMAP.** Odoo genera un `mail.message` locale con lo stesso `Message-Id` che finisce nell'header dell'email inviata; quando la ripesca via fetchmail, la sua stessa protezione anti-loop (`mail_thread.py:1415`, `is_duplicate = mail.message.search_count([('message_id','=', msg_id)])`) la riconosce come "già vista" e la ignora silenziosamente (log: *"found duplicated Message-Id during processing"*, nessuna eccezione, nessun errore visibile). Ho verificato che questo capita **sempre**, non solo alla prima email (riprovato con un secondo Message-Id fresco, stesso esito). La soluzione corretta e verificata: mandare l'email di test da **fuori Odoo** (usato `smtplib` diretto con le stesse credenziali SMTP, bypassando `mail.mail`) — così il Message-Id non è mai stato visto da Odoo prima. **Questo vale per qualunque test futuro di self-loop email su questo circuito o su TEE**, non solo per questo giro: vale la pena documentarlo come nota permanente, non solo qui.

(Nota laterale: questo spiega probabilmente perché la Fase 0 di un giro precedente aveva trovato solo "0 messaggi" iniziali — non ho verificato retroattivamente se test email precedenti su TEE in questa sessione abbiano usato `mail.mail` interno o smtplib esterno; se il primo, potrebbero aver avuto lo stesso problema silenzioso senza che nessuno se ne accorgesse.)

Un secondo problema minore incontrato durante il debug: i miei primi tentativi di rilanciare `odoo shell` con `--logfile=/dev/null` (pattern usato per pulizia dell'output in tutta questa sessione) **nascondeva anche gli errori reali** (compreso il primo `ValueError` su `assignment_reason`, se fosse capitato lì) — per debug reale va rimosso quel flag, non solo per i print ma per i log interni di Odoo stesso.

---

## Debito tecnico esplicito

- **Email log semplificato rispetto a TEE**: `erpv6.winwin.email.log` riconosce solo il **mittente**, non il destinatario (TEE ha entrambi). Aggiungibile con lo stesso schema di `aeosv6_dispatch.py` se serve.
- **Nessun `ir.rule` su `production.order`** per la dashboard — il filtro vive nel metodo, non nel modello (vedi sopra).
- **Nessun test di interazione browser reale** sul componente OWL (click, rendering visivo, verifica del CSS applicato) — nessuno strumento di automazione browser disponibile in questo giro, stesso limite già dichiarato per la pagina report Next.js in un report precedente di questo circuito. Verificato invece: sintassi JS pulita (`node --check`), XML del modulo caricato senza errori (`-u` pulito), action/menu/record esistono nel DB.
- **Vincolo Odoo sui test self-loop via mail.mail** (sopra) — non un debito da "risolvere", ma una nota operativa permanente da tenere a mente per test futuri su questo o altri circuiti email.
- **Dashboard senza restrizione di gruppo esplicita** (nessun `groups_id` sul menu/azione, visibile a `base.group_user` come il resto delle viste di questo progetto) — coerente col resto ma non isolato a un gruppo "Consulenti" dedicato, se mai servisse.
- **Tunnel verso frontend esterno**: architettura pronta (endpoint dati `@api.model` separati dalla vista) ma non costruita, come esplicitamente richiesto dal prompt (Fase futura).

## File toccati in questo run (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- **Nuovi**: `models/tracking_relation_extension.py`, `models/booking_token_extension.py`, `models/production_order_dashboard_extension.py`, `models/email_log.py`, `views/winwin_dashboard_views.xml`, `static/src/{js,xml,scss}/winwin_dashboard.*`
- **Modificati**: `models/gate.py` (token tracciabile), `models/__init__.py`, `__manifest__.py` (dipendenza `aeosv6_relation`, nuovo data file, bundle `assets`), `security/ir.model.access.csv`
- Sincronizzati anche in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/` (intera cartella, `rsync --delete` esclusi `__pycache__`, `diff -rq` pulito)
- **DB**: 1 `fetchmail.server` nuovo, 1 `ir.mail_server` nuovo (entrambi per `v6impresa.it`, testati)
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima/dopo — `aeosv6_relation`/`aeosv6_project_relay`/`aeosv6_booking` di TEE restano come dipendenze installate già esistenti, non modificate; `erpv6_production/erpv6_typst` con modifiche di altro lavoro precedente restano intatte)
- Dati di test creati: lead #158 (riusato), production_order #71 (riusato), token booking #6, tracking.relation #11 (root) + figlio Stefano Puglisi, `erpv6.agent.communication` #20, `erpv6.winwin.email.log` #1, `erpv6.production.consulente.line` aggiornata (ruolo delivery, reason `sourcing_diretto`)

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_TRIGGER_DASHBOARD_REPORT.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_TRIGGER_DASHBOARD_REPORT.md
```
