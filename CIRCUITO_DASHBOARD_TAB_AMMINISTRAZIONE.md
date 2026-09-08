# Dashboard: quarta tab "Amministrazione" (solo group_system) — Parte A

Branch `feature/circuito-winwin-renderdata`. Nessun commit, nessun push. **Solo Parte A** eseguita (Fase 0-4) — Parte B (notifiche email) NON toccata, come richiesto esplicitamente.

**Stato: completato e verificato dal vivo con dati/utenti reali. Nessun blocco.**

---

## Fase 0 — Verifica

1. `erpv6.consulting.consultant`: confermato, unico collegamento a un utente reale è via `partner_id` (Many2one obbligatorio a `res.partner`); `brand_id` (Many2one obbligatorio a `erpv6.consulting.brand`, non `erpv6.brand` come si potrebbe supporre) — 2 brand reali esistenti: "Progetto Impresa" (id 5, usato da Stefano e Martina), "Zero Sprechi" (id 6). Nessun link diretto a `res.users` sul modello.
2. `erpv6.tracking.relation.ruolo`: Selection reale = `[gestore, parte_attiva, osservatore]` — **`referral` non esiste**, andrà aggiunto quando si costruirà l'azione separata "aggiungi referral a un progetto" (fuori scope qui, il prompt lo conferma esplicitamente).
3. `base.group_system` esiste nativo (id 4, "Settings") — nessun gruppo nuovo creato, come richiesto.
4. Utenti reali di test disponibili confermati: Stefano Puglisi (id 15) e Martina Garbin (id 16) sono utenti interni reali, **entrambi NON in `group_system`** — candidati perfetti per il test "tab assente".

## Fase 1 — Visibilità condizionata

Nuovo file `models/admin_dashboard_extension.py` (estende `res.users`, nessun modulo nuovo, nessun rischio di dipendenza circolare — `res.users` è nativo):
- `is_admin_user()` (`@api.model`) → `self.env.user.has_group('base.group_system')`.
- `get_admin_dashboard_data()` (`@api.model`) → **ri-controlla `is_admin_user()` anche lato server** (non si fida del fatto che il frontend chiami l'endpoint solo se admin) e solleva `UserError` altrimenti.

Nel componente OWL (`winwin_dashboard.js`): `loadAll()` chiama sempre `is_admin_user()`; il bottone/contenuto della quarta tab hanno `t-if="state.isAdmin"` nel template XML — **il nodo non esiste nel DOM per un non-admin**, non è nascosto via CSS (verificabile ispezionando l'HTML generato: zero occorrenze del bottone "Amministrazione" se `isAdmin` è `false`).

## Fase 2 — Creazione consulente

`erpv6.consulting.consultant.action_create_from_dashboard(user_id, brand_id)`: ricontrolla `group_system` lato server, verifica che l'utente esista, blocca il duplicato se un consulente è già collegato a quel `partner_id` (`UserError` chiaro, non un `IntegrityError` criptico). UI: due `<select>` (utenti candidati = interni non ancora collegati a un consulente; brand) + bottone.

## Fase 3 — Creazione referral

`res.partner.action_create_referral(name, email, phone)`: cerca un partner esistente per nome/email, se trovato lo tagga (categoria "Referral (Win-Win)", creata al volo se non esiste) senza duplicare; altrimenti crea il partner nuovo con la stessa tag. **Non crea nessun Arco `erpv6.tracking.relation`** — puro dato anagrafico, come richiesto.

## Fase 4 — Verifica end-to-end (dati reali, non payload finti)

- **Admin (Denis)**: `is_admin_user() → True`; `get_admin_dashboard_data()` → lista candidati reali (esclusi Stefano/Martina, già consulenti), 2 brand reali, 2 consulenti esistenti.
- **Stefano (non-admin, utente reale)**: `is_admin_user() → False`; chiamata diretta a `get_admin_dashboard_data()` → **bloccata con `UserError` reale** ("Solo un amministratore può accedere a questi dati") — verificato lato endpoint, non solo dedotto dal frontend.
- **Creazione consulente reale**: creato per l'utente reale "Api vercel v6impresa" + brand "Progetto Impresa" → id 3 confermato; secondo tentativo sullo stesso utente → bloccato correttamente (duplicato).
- **Creazione referral reale**: "Mario Referral Test" creato (id 96, `created: True`); stessa chiamata ripetuta → trovato esistente, non duplicato (`created: False`).
- Modulo aggiornato (`-u erpv6_winwin_renderdata`) senza errori, sito verificato raggiungibile dopo restart, `node --check` sul JS e parsing XML puliti.
- **Pulizia**: consulente id 3 e partner id 96 di test rimossi a fine verifica (`sudo().unlink()`), nessun dato reale toccato.

## Debito tecnico esplicito

- Nessun test di interazione browser reale (stesso limite dichiarato in tutti i report precedenti di questo lavoro — nessuno strumento di automazione browser disponibile).
- Il form referral fa un upsert per nome/email esatto (non una vera ricerca/autocomplete su partner esistenti) — "minimo" come richiesto dal prompt, ma se in futuro serve trovare un partner con nome leggermente diverso, andrà aggiunta una ricerca più tollerante.
- La lista "utenti candidabili a consulente" in Fase 2 esclude solo chi ha già un `erpv6.consulting.consultant` — non filtra per gruppo/ruolo (es. mostrerebbe anche utenti tecnici come "Api vercel v6impresa", usato qui solo come target di test neutro). Se serve restringere ulteriormente (es. solo utenti con un certo gruppo), è una modifica di una riga nel dominio di `get_admin_dashboard_data()`.

## File toccati (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- **Nuovo**: `odoo-modules/erpv6_winwin_renderdata/models/admin_dashboard_extension.py`
- **Modificati**: `models/__init__.py`, `static/src/js/winwin_dashboard.js`, `static/src/xml/winwin_dashboard.xml`, `static/src/scss/winwin_dashboard.scss`
- Sincronizzati in `/opt/erpv6/custom-addons/erpv6_winwin_renderdata/` (`rsync --delete` esclusi `__pycache__`)
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima/dopo — Progetto TEE, `erpv6_production`/`erpv6_typst` di altro lavoro, tutto intatto)
- Dati di test creati e rimossi a fine verifica: `erpv6.consulting.consultant` id 3, `res.partner` id 96 — nessuna traccia residua

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_DASHBOARD_TAB_AMMINISTRAZIONE.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_DASHBOARD_TAB_AMMINISTRAZIONE.md
```
