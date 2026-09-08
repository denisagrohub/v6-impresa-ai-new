# Dashboard OWL — 4 correzioni da uso reale su mobile

Continua da `CIRCUITO_NOTIFICHE_EMAIL_PROGETTI.md`. Branch `feature/circuito-winwin-renderdata`. Nessun commit, nessun push.

**Stato: tutti e 4 i problemi affrontati e verificati dal vivo dove possibile — nessuno strumento di automazione browser disponibile in questo giro, quindi la resa visiva reale su un telefono resta da confermare dall'utente stesso.**

---

## Problema 1 — Tab non responsive su mobile

**Causa reale confermata leggendo il CSS**: `.o_winwin_tabs { display: flex; gap: 8px; }` — nessun `flex-wrap`, nessuna regola per schermi stretti. Con 3-4 tab ("Richieste in arrivo", "I miei progetti", "Progetti & Relazioni", eventualmente "Amministrazione"), la larghezza totale supera facilmente i 375-414px di un telefono.

**Corretto**:
- `flex-wrap: wrap` su `.o_winwin_tabs`.
- `box-sizing: border-box` globale sul componente + `max-width: 100%` + `overflow-x: hidden` sul contenitore radice — nessun elemento del componente può più causare overflow orizzontale della pagina (motivazione tecnica: su mobile un overflow orizzontale anche minimo trasforma i tap in gesture di scroll, comportamento nativo dei browser — plausibile concausa anche del Problema 2).
- Media query `max-width: 576px`: tab impilate a piena larghezza, header in colonna, card impilate, `.o_winwin_card_meta` va a capo.

**Verificato**: lettura del CSS generato, calcolo delle larghezze. **Non verificato**: rendering visivo reale su un dispositivo (nessuno strumento disponibile).

## Problema 2 — I progetti non si aprono

**Non ho trovato un bug di logica nel JS/XML esistente** (verificato: dati restituiti da `get_miei_progetti()`/`get_miei_progetti_generici()` sempre completi per i casi reali controllati, `toggleExpand`/`toggleExpandRelazione` corretti). L'ipotesi più concreta è collegata al Problema 1 (overflow orizzontale che rompe i tap su mobile), ma non potendo verificarlo visivamente ho aggiunto una **seconda via, indipendente e garantita**:

- Nuovo bottone **"Apri scheda"** su ogni riga progetto (sia tab "I miei progetti" sia "Progetti & Relazioni"), che apre la vista form nativa Odoo del record vero (`erpv6.production.order` o `erpv6.tracking.relation`) via `actionService.doAction(...)` — non una vista nuova, riusa il form esistente.
- La testata è stata ristrutturata: la parte titolo (`o_winwin_project_head_main`) resta cliccabile per il toggle inline, il nuovo bottone è un elemento separato con `t-on-click.stop` (non interferisce col toggle).

**Verificato**: sintassi JS/XML pulita, upgrade modulo senza errori, i record verso cui puntano le azioni (`production.order`/`tracking.relation`) esistono e sono leggibili. **Non verificato**: il click reale in un browser (stesso limite di sempre).

## Problema 3 — Le notifiche non si segnano come lette

**Costruito**: `erpv6.tracking.relation.mark_notifications_read()` — segna `is_read=True` (meccanismo nativo `mail.notification`, nessuna gestione separata reinventata) per l'utente corrente sul nodo. Richiamabile cliccando il pallino del badge (`o_winwin_badge_clickable`, `t-on-click.stop`) in entrambe le tab progetti; dopo l'azione ricarica tutti i dati (`loadAll()`), quindi il badge sparisce senza refresh manuale.

Per la tab "I miei progetti" (Win-Win) serviva sapere l'id del nodo `tracking.relation` collegato (diverso dall'id del progetto): aggiunto `relation_root_id` al payload di `get_miei_progetti()`.

**Verificato dal vivo, con dati reali**:
- Notifica TEE esistente (Progetto TEE id 5, Denis, lasciata apposta dal giro precedente): `unread 1 → mark_notifications_read() → unread 0`.
- Stesso test su un nodo Win-Win (id 11, Stefano): `unread 1 → 0`.

## Problema 4 — Forzare la notifica in-app sempre, anche con preferenza email

**Causa** (già individuata nel report precedente): `message_notify()` instrada su inbox o email "a seconda della configurazione utente" (comportamento nativo Odoo, verificato leggendo `mail_thread.py`) — per un utente con preferenza "Email" (es. Stefano) non genera mai una voce non letta in campanella.

**Corretto in `notify_new_email()`**: dopo la chiamata standard a `message_notify()`, la riga `mail.notification` già creata per il destinatario viene forzata esplicitamente a `notification_type='inbox', is_read=False` — non tocca la preferenza personale dell'utente (resta sua), forza solo l'esito di questa specifica notifica.

**Verificato dal vivo con Stefano** (preferenza "Email", stesso utente su cui il test precedente falliva):
```
notify_new_email() → mail.notification per Stefano: notification_type=inbox, is_read=False
get_unread_notification_count() (come Stefano): 0 → 1
```
Poi verificato che `mark_notifications_read()` (Problema 3) la azzera correttamente anche per lui.

---

## Debito tecnico esplicito

- **Nessuna verifica visiva/di interazione reale su un dispositivo mobile** — tutte le correzioni sono verificate a livello di CSS generato, dati, e comportamento server-side, non con uno screenshot o un tocco reale. Da confermare dall'utente.
- Il Problema 2 resta parzialmente un'ipotesi (overflow orizzontale) non confermata in modo diretto — il bottone "Apri scheda" è una soluzione robusta indipendente da quell'ipotesi, quindi il problema pratico ("non riesco ad aprire un progetto") dovrebbe essere risolto comunque anche se l'ipotesi originale fosse sbagliata.
- Forzare `notification_type='inbox'` non impedisce che parta anche l'email per un utente con quella preferenza (comportamento standard di `message_notify()` avvenuto prima della nostra riscrittura) — l'utente riceverà quindi sia l'email sia la notifica in-app. Non richiesto di sopprimere l'email, solo di garantire l'in-app "sempre".

## Dati di test toccati (non nuovi, riusati da giri precedenti)

- Progetto TEE (id 5): 1 notifica di test segnata come letta durante la verifica (era già lì dal giro precedente, nessun dato di Enzo/Manuel toccato).
- Nodo Win-Win id 11 (progetto di test "TEST WEB ASYNC E2E 2"): 1 notifica di test creata e poi segnata come letta durante la verifica del Problema 4.

## File toccati (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- `odoo-modules/erpv6_winwin_renderdata/models/tracking_relation_extension.py` (+`mark_notifications_read()`, `notify_new_email()` forza inbox)
- `odoo-modules/erpv6_winwin_renderdata/models/production_order_dashboard_extension.py` (+`relation_root_id`)
- `odoo-modules/erpv6_winwin_renderdata/static/src/js/winwin_dashboard.js` (+`openProductionOrder`, `openTrackingRelation`, `markNotificationsRead`)
- `odoo-modules/erpv6_winwin_renderdata/static/src/xml/winwin_dashboard.xml` (testata progetto ristrutturata, bottone "Apri scheda", badge cliccabile)
- `odoo-modules/erpv6_winwin_renderdata/static/src/scss/winwin_dashboard.scss` (responsive tab/mobile, nuovi stili)
- Sincronizzati in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/`, `-u erpv6_winwin_renderdata` senza errori, sito verificato raggiungibile dopo restart
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima/dopo)

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_DASHBOARD_MOBILE_FIX.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_DASHBOARD_MOBILE_FIX.md
```
