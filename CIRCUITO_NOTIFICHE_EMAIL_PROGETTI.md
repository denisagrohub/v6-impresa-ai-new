# Notifiche su nuova email captata (TEE + Win-Win) — PARTE B

Continua da `CIRCUITO_DASHBOARD_TAB_AMMINISTRAZIONE.md` (Parte A, confermata dall'utente). Branch `feature/circuito-winwin-renderdata`. Nessun commit, nessun push.

**Stato: completato e verificato dal vivo su entrambi i sistemi (TEE e Win-Win), con un'anomalia architetturale reale scoperta e corretta prima di implementare, e un secondo comportamento nativo di Odoo scoperto durante il test finale (non un bug, documentato).**

---

## Scoperta che ha cambiato l'implementazione: `erpv6.agent.communication` non notifica mai il vero destinatario

Il prompt chiedeva di riusare `erpv6.agent.communication.create_and_route()`, lo stesso canale già usato per l'escalation Gate 3B e per "prendi in carico". Verificato leggendo il codice reale (`erpv6_agent/models/agent_config.py`):

- `route()` → `_route_via_susanna()` → `susanna.notify_pending_confirmation(res_model=..., res_id=...)` — **senza `notify_partner_ids` esplicito**.
- `notify_pending_confirmation()`, se `notify_partner_ids` non è passato, chiama `_default_notify_partner_ids()`.
- `_default_notify_partner_ids()`: se l'agente (qui Susanna) ha un `notify_partner_ids` configurato lo usa, **altrimenti ricade SEMPRE su `base.user_admin`** (Denis).
- Verificato dal vivo: Susanna ha `notify_partner_ids` vuoto oggi.

**Conseguenza reale**: `create_and_route()` notifica SEMPRE e SOLO Denis via la campanella nativa, indipendentemente da `assignee_user_id`/`reviewer_user_id` scritti sul record. Questo contraddice il requisito esplicito di questa parte ("si applica a chiunque sia collegato al progetto, non solo admin") — e vale anche per la notifica "prendi in carico" già shippata in `booking_token_extension.py` in un giro precedente (stessa causa, **mai stata una notifica reale per Stefano/Martina**, solo per Denis). Non l'ho corretta lì (fuori dal mandato di questo giro, segnalo qui per completezza — l'utente può decidere se vale la pena sistemarla).

**Scelta fatta**: `notify_new_email()` (nuovo metodo su `erpv6.tracking.relation`, in `erpv6_winwin_renderdata/models/tracking_relation_extension.py`) usa **`message_notify()` diretto** sul nodo progetto, con `partner_ids=[owner.partner_id.id]` esplicito — stesso meccanismo nativo (`mail.notification`) usato *internamente* da `notify_pending_confirmation`, ma senza il livello Susanna che avrebbe perso il destinatario reale. Nessuna modifica a `erpv6_agent` (modulo condiviso, fuori scope, rischio troppo ampio per questo giro).

## Cosa costruito

1. **`erpv6.tracking.relation.notify_new_email(subject, sender_email)`** (`erpv6_winwin_renderdata/models/tracking_relation_extension.py`): risolve la radice dell'albero, legge `owner_user_id`, chiama `message_notify()` verso il suo partner. Nessun filtro di rilevanza — chiamato sempre, per ogni email.
2. **Hook in `erpv6.winwin.email.log.message_new()`** (stesso modulo): dopo `super().message_new()`, se `relation_id` è valorizzato, chiama `notify_new_email()` in un `try/except` best-effort (mai un rollback — cancellerebbe il log appena salvato).
3. **Hook in `erpv6.project.email.log.message_new()`** (TEE, `aeosv6_project_relay`): stesso schema, ma con `getattr(relation, 'notify_new_email', None)` difensivo — `aeosv6_project_relay` non dipende (e non deve dipendere) da `erpv6_winwin_renderdata`, che dipende già da lui: una dipendenza diretta avrebbe creato un ciclo (stesso problema già scoperto e corretto per `group_project_relation_manager` in un giro precedente). Se `erpv6_winwin_renderdata` non fosse installato, il log TEE resta comunque funzionante senza la notifica.
4. **`get_unread_notification_count()`** (stesso file): conteggio nativo (`mail.notification`, `is_read=False`, per l'utente corrente) sui messaggi del nodo — non su `erpv6.agent.communication` (canale diverso, resta per altri usi già esistenti).
5. **Badge nella dashboard OWL**: `unread_count` aggiunto sia a `get_miei_progetti()` (Win-Win, `production_order_dashboard_extension.py`) sia a `get_miei_progetti_generici()` (TEE/generico, stesso file di `notify_new_email`). Nuovo elemento `.o_winwin_badge` in `winwin_dashboard.xml` (accanto al titolo progetto in entrambe le tab) e stile SCSS (pallino terracotta, stessa palette).

## Verifica end-to-end reale, su entrambi i sistemi

Inviate due email reali via `smtplib` diretto (mai `mail.mail` interno, per evitare la deduplicazione Message-Id già documentata due volte in questo lavoro) verso alias di progetto reali già esistenti:

- **TEE**: `progetto-tee@v6sviluppoimpresa.it` (root "Progetto TEE", id 5, owner Denis) — mittente di test chiaramente riconoscibile (`catchall@v6sviluppoimpresa.it`, non Enzo/Manuel, nessun dato reale del progetto toccato).
- **Win-Win**: `progetto-test-web-async-e2e-2-71@v6impresa.it` (root "Progetto TEST WEB ASYNC E2E 2", id 11, owner Stefano Puglisi — progetto di test di un giro precedente, non un caso reale).

Eseguito un fetch bloccante una tantum su entrambi i `fetchmail.server` (non un ciclo, come richiesto).

**Risultato TEE (verificato numero prima/dopo)**:
- Log creato (`erpv6.project.email.log` id 5, `match_status='matched'`, `relation_id=5`).
- Notifiche non lette per Denis su nodo 5: **0 → 1**.
- `get_miei_progetti_generici()` chiamato come Denis: `unread_count: 1` su "Progetto TEE" — badge reale, non dedotto.

**Risultato Win-Win (log creato, ma badge a 0 — comportamento nativo Odoo, non un bug, spiegato sotto)**:
- Log creato (`erpv6.winwin.email.log` id 2, `match_status='matched'`, `relation_id=11`).
- `mail.message` creato correttamente (id 7969, "Nuova email su ...").
- **Il conteggio non lette per Stefano resta 0** — verificato il motivo: la `mail.notification` generata ha `notification_type='email'`, `is_read=True` fin da subito, perché **Stefano ha la preferenza personale "Notifiche via Email"** (`res.users.notification_type='email'`), non "Inbox" come Denis. Per un utente con questa preferenza, Odoo instrada la notifica come email in uscita invece che come voce non letta nella campanella in-app — comportamento nativo corretto, non una mia scelta né un bug del conteggio: `notification_status` risultava `'sent'` (Odoo ritiene di averla mandata), ma non ho verificato la consegna reale della mail (nessun `mail.mail` persistito da controllare, comportamento atteso se `auto_delete` è attivo su invio riuscito) - fuori scope approfondire oltre per questo giro.

**Implicazione onesta da segnalare**: il badge numerico in dashboard funziona correttamente e in modo verificato SOLO per gli utenti con preferenza "Inbox" (es. Denis). Per chi ha preferenza "Email" (es. Stefano oggi), la notifica arriva comunque (via email, non via badge) - non è un canale rotto, ma il badge da solo non basta a dire "hai qualcosa di non letto" per quel tipo di utente. Non ho cambiato la preferenza di Stefano (impostazione personale sua, non mia da toccare).

## Debito tecnico esplicito

- ~~`create_and_route()`/Susanna non notifica mai il vero assegnatario — vale anche per "prendi in carico"~~ **RISOLTO 08/09/2026**: `erpv6.booking.token.action_prendi_in_carico()` ora chiama `root_relation.notify_owner()` (stesso `message_notify()` diretto, estratto come metodo riusabile su `erpv6.tracking.relation`) verso il consulente reale. `create_and_route()`/Susanna resta SOLO per popolare il pannello "notifiche" della dashboard (audit trail), non è più l'unico canale di notifica. Verificato dal vivo su nodo 11 (Stefano): `unread 0→1`, poi pulito.
- ~~Badge affidabile solo per preferenza "Inbox"~~ **RISOLTO 07/09/2026 sera**, vedi `CIRCUITO_DASHBOARD_MOBILE_FIX.md` Problema 4: `notify_owner()` forza `notification_type='inbox', is_read=False` sulla riga `mail.notification` del destinatario, indipendentemente dalla sua preferenza personale. Verificato dal vivo con Stefano (preferenza "Email").
- **Consegna email reale a Stefano non riverificata oltre lo stato interno Odoo** (`notification_status='sent'`) — nessun `mail.mail` persistito da controllare (probabile `auto_delete` post-invio).
- Nessun test di interazione browser reale sul badge (stesso limite dichiarato in tutti i report precedenti di questo lavoro).
- Dato di test aggiuntivo creato durante il debug diretto (`notify_new_email` chiamato manualmente una volta su nodo 11 con dati fittizi "Test diretto"/"debug@test.it") — la chiamata era dentro uno script chiuso da `env.cr.rollback()`, quindi il record ORM non dovrebbe essere persistito, ma se `message_notify` avesse già innescato un invio email sincrono prima del rollback, quell'invio (se avvenuto) non è annullabile. Impatto minimo, indirizzo di test interno.

## Dati di test lasciati nel sistema (non ripuliti, per coerenza con report precedenti di questo lavoro)

- `erpv6.project.email.log` id 5 ("TEST notifica badge TEE ...") su Progetto TEE (id 5) — reale, non tocca Enzo/Manuel.
- `erpv6.winwin.email.log` id 2 ("TEST notifica badge WINWIN ...") su progetto di test id 11.
- 1 notifica non letta reale per Denis su Progetto TEE (id 5) — visibile nella sua campanella Odoo finché non la segna letta.

## File toccati (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- **Modificati**: `odoo-modules/erpv6_winwin_renderdata/models/tracking_relation_extension.py` (+`notify_new_email`, +`get_unread_notification_count`), `models/email_log.py` (hook post-save), `models/production_order_dashboard_extension.py` (+`unread_count`), `static/src/xml/winwin_dashboard.xml` (+badge in 2 tab), `static/src/scss/winwin_dashboard.scss` (+stile `.o_winwin_badge`)
- **Modificato**: `odoo-modules/aeosv6_project_relay/models/project_email_log.py` (hook post-save, difensivo)
- Sincronizzati in `/opt/erpv6/custom-addons/` (entrambi i moduli), `-u erpv6_winwin_renderdata,aeosv6_project_relay` senza errori, sito verificato raggiungibile dopo restart
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima/dopo)

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_NOTIFICHE_EMAIL_PROGETTI.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_NOTIFICHE_EMAIL_PROGETTI.md
```
