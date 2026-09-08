# Dashboard: terza sezione "Progetti & Relazioni" (erpv6.tracking.relation)

Continua da `CIRCUITO_TRIGGER_DASHBOARD_REPORT.md`. Branch `feature/circuito-winwin-renderdata` (stesso di tutto il circuito). Nessun commit, nessun push.

**Stato: fatto e verificato dal vivo, inclusi i due test di sicurezza richiesti. Nessun blocco.**

---

## Decisione architetturale: dove vive il nuovo codice

`owner_user_id` e l'endpoint `get_miei_progetti_generici()` vivono in **`erpv6_winwin_renderdata`** (file `models/tracking_relation_extension.py`, già esistente, esteso), NON in `aeosv6_relation` — stesso motivo già documentato nel file per `production_order_id`: `aeosv6_relation` è lavoro non committato di un altro thread (Progetto TEE), e l'inheritance Odoo aggiunge il campo al modello per intero indipendentemente da quale modulo lo dichiara, quindi l'effetto è comunque generico (si applica anche a "Progetto TEE", non solo ai progetti Win-Win).

**Eccezione verificata e documentata**: ho comunque dovuto modificare una riga in `aeosv6_relation/security/ir.model.access.csv` (perm_create 1→0 per `base.group_user`) — i permessi Odoo sono un OR tra le righe ACL che matchano un utente/modello: **non è possibile restringere un permesso aggiungendo una riga più restrittiva da un altro modulo**, solo togliendolo dalla riga originale. Verificato che questo non rompe nulla di reale: l'admin (Denis) è in `base.group_system` (perm_create=1 indipendente), e l'unico altro creatore reale di nodi (`Stefano Puglisi`, via `action_prendi_in_carico()`) passa sempre da `.sudo()` in `booking_token_extension.py`, che bypassa comunque le ACL.

## Cosa costruito

1. **Restrizione creazione**: `aeosv6_relation/security/ir.model.access.csv` — `base.group_user` non può più creare `erpv6.tracking.relation` (resta lettura/scrittura). Nuovo gruppo `group_project_relation_manager` ("Gestori Progetti") in `erpv6_winwin_renderdata/data/security_project_managers_data.xml`, con una riga ACL propria (`perm_create=1`) in `erpv6_winwin_renderdata/security/ir.model.access.csv`. Assegnazione dei delegati è un'azione manuale successiva (Impostazioni → Utenti) — non automatizzata qui.
2. **`owner_user_id`** (Many2one `res.users`, default `env.uid` alla creazione, riassegnabile) su `erpv6.tracking.relation`.
3. **`get_miei_progetti_generici()`** (`@api.model`, stesso pattern degli altri due endpoint dashboard): nodi radice (`parent_id=False`) con `owner_user_id=env.uid`, per ciascuno: nome, alias email completo (riusa `email_alias_full`, già disponibile da `aeosv6_project_relay` — aggiunta come nuova dipendenza del manifest), parti collegate, ultime 20 email (`erpv6.project.email.log` sull'intero albero radice+figli), notifiche (`erpv6.agent.communication` via `res_model`/`res_id` generico — nessun collegamento preesistente trovato per tracking.relation, il meccanismo regge comunque, oggi restituisce semplicemente lista vuota finché nessuna notifica reale li referenzia).
4. **Terza tab dashboard OWL** "Progetti & Relazioni" (`winwin_dashboard.js`/`.xml`) — stesse classi CSS già esistenti per "I miei progetti" (nessuna nuova regola SCSS necessaria), stesso principio endpoint-dati-separato-dalla-vista.
5. **Backfill sui dati reali esistenti** (non test): `owner_user_id` impostato su "Progetto TEE" (id 5) → Denis (admin, `method@agrohubitalia.it`) e su "Progetto TEST WEB ASYNC E2E 2" (id 11, Win-Win) → Stefano Puglisi (chi l'aveva effettivamente creato) — senza questo backfill i progetti già esistenti sarebbero rimasti invisibili a chiunque nella nuova sezione.

## Verifica dal vivo

- **Upgrade pulito**: `-u aeosv6_relation,aeosv6_project_relay,erpv6_winwin_renderdata` senza errori, `node --check` sul JS pulito.
- **Sicurezza, blocco**: creato un utente interno di test SENZA il nuovo gruppo → `create()` su `erpv6.tracking.relation` → `AccessError` reale ("You are not allowed to create..."). Utente di test rimosso a fine verifica.
- **Sicurezza, permesso**: stesso utente aggiunto al gruppo `group_project_relation_manager` → `create()` riuscito, `owner_user_id` popolato correttamente di default sul creatore.
- **Dati reali**: `get_miei_progetti_generici()` chiamato come l'admin reale → restituisce "Progetto TEE" con entrambe le parti (Enzo Furlanetto, Manuel Bortolami) e l'email reale già catturata in una sessione precedente di questa conversazione ("Re: Progetto tee invio prima email per condivisione contatti") — dati veri, non un caso di test scritto per l'occasione.

## Correzione post-revisione: il wizard TEE "Nuovo Progetto" non passa da .sudo()

L'utente ha chiesto verifica esplicita di un rischio reale non controllato in questo report: se il Progetto TEE ha un flusso di creazione di `erpv6.tracking.relation` che non passa da `.sudo()` e non gira come admin, la nuova restrizione potrebbe averlo rotto.

**Confermato, verificato riga per riga**: il wizard "Nuovo Progetto" (`erpv6.project.relay.new.project.wizard.action_confirm()`) chiama `node.run_process(...)`; `erpv6.core.node.run_process()` (`erpv6_core_engine/models/core_node.py:715`) esegue `process['run'](self.env, self, input_data)` — l'`env` di chi chiama, **mai sudo**; `_run_create_project_node()` (`aeosv6_dispatch.py:123`) fa `env['erpv6.tracking.relation'].create(vals)` diretto. Il menu "Nuovo Progetto" non aveva inoltre nessuna restrizione di gruppo: chiunque lo vedeva e poteva aprirlo.

**Non era una rottura silenziosa** (l'eccezione viene rilanciata da `run_process()` e arriva come errore visibile), ma era comunque la restrizione che funzionava correttamente lato dati mentre l'interfaccia continuava a mostrare l'opzione a chi non ne aveva diritto, con un `AccessError` Python invece di un menu semplicemente assente.

**Corretto**: il gruppo `group_project_relation_manager` è stato **spostato da `erpv6_winwin_renderdata` a `aeosv6_relation`** (scoperto un secondo problema nel farlo: definirlo in `erpv6_winwin_renderdata` e referenziarlo dal menu di `aeosv6_project_relay` avrebbe creato una dipendenza circolare, dato che `erpv6_winwin_renderdata` dipende da `aeosv6_project_relay`). Il menu `menu_new_project_wizard` ora ha `groups="base.group_system,aeosv6_relation.group_project_relation_manager"`.

**Verificato dal vivo con un secondo test di sicurezza completo**: utente senza il gruppo → menu invisibile (`ir.ui.menu.search()` con `with_user` non lo trova) E creazione bloccata con `AccessError`; stesso utente aggiunto al gruppo → menu visibile, creazione riuscita; utente autorizzato NON può eliminare (`perm_unlink=0`, verificato con un secondo `AccessError` reale, comportamento corretto). Modulo aggiornato (`-u aeosv6_relation,erpv6_winwin_renderdata,aeosv6_project_relay`) senza errori, sito verificato raggiungibile dopo il riavvio.

## Debito tecnico esplicito

- **Notifiche**: il collegamento `erpv6.agent.communication` → `erpv6.tracking.relation` è supportato dal meccanismo generico ma oggi nessuna notifica reale lo usa (nessuna notifica è mai stata creata con `res_model='erpv6.tracking.relation'`) — la sezione funziona ma mostrerà sempre "nessuna notifica" finché qualcosa non la popola.
- **Assegnazione delegati**: il nuovo gruppo esiste ma nessun utente reale (oltre l'admin, già coperto da `group_system`) vi è stato aggiunto — è un passo amministrativo manuale successivo, non automatizzato in questo giro.
- **Nessun test di interazione browser reale** sulla nuova tab (stesso limite già dichiarato per il resto della dashboard OWL) — verificato solo lato dati/sicurezza/sintassi.

## File toccati (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- **Modificato**: `odoo-modules/aeosv6_relation/security/ir.model.access.csv` (1 riga, restrizione perm_create)
- **Modificati**: `odoo-modules/erpv6_winwin_renderdata/{models/tracking_relation_extension.py, security/ir.model.access.csv, __manifest__.py, static/src/js/winwin_dashboard.js, static/src/xml/winwin_dashboard.xml}`
- **Nuovo**: `odoo-modules/erpv6_winwin_renderdata/data/security_project_managers_data.xml`
- Sincronizzati anche in `/opt/erpv6/custom-addons/` (entrambi i moduli, `diff -rq` pulito)
- **DB**: `owner_user_id` backfillato su 2 nodi radice reali (id 5, id 11) — nessun altro dato esistente toccato
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima/dopo)

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_TRIGGER_DASHBOARD_TRACKING_RELATION.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_TRIGGER_DASHBOARD_TRACKING_RELATION.md
```
