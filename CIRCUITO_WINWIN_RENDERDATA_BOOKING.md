# Circuito Win-Win — Collegamento al sistema di prenotazione (aeosv6_booking)

Continua da `CIRCUITO_WINWIN_RENDERDATA_WEB_ASYNC.md`. Branch: `feature/circuito-winwin-renderdata` (locale, nessun commit, nessun push).

**Stato: verifica completa, rinomina fatta, collegamento fatto e testato end-to-end con dati reali. Nessun blocco.**

---

## 1. Verifica del modulo prima di rinominarlo

Letto tutto `odoo-modules/erpv6_booking/` e confrontato con `/opt/erpv6/custom-addons/erpv6_booking/`. Il "disallineamento noto" era **innocuo**: `models/__init__.py` (identico in sorgente e deploy) importa SOLO `booking_token` e `booking_wizard` — **mai** `pi_booking_token.py`/`attic_pi_booking_token.py` né `res_partner.py`, che sono codice morto (modello legacy `pi.booking.token` su `res.partner`, mai caricato da Odoo in nessuna delle due versioni). Rinominare/sincronizzare quel file non aveva nessun impatto funzionale — verificato leggendo il codice, non solo assunto.

Modulo installato correttamente (`erpv6_booking`, `18.0.1.0.0`), 2 consulenti reali (`erpv6.consulting.consultant`: Stefano Puglisi id 1, Martina Garbin id 2), 4 token esistenti. Un solo consumer esterno reale: `erpv6_api_gateway/__manifest__.py` (dipendenza dichiarata) — nessun altro modulo Odoo o pagina Next.js referenzia il nome tecnico del modulo (solo un commento in `route.ts`, aggiornato per coerenza).

## 2. Sincronizzazione + rinomina `erpv6_booking` → `aeosv6_booking`

Stessa procedura già usata in questa sessione per `erpv6_relation`/`erpv6_project_relay`:
- Cartella rinominata in `odoo-modules/` e in `/opt/erpv6/custom-addons/` (rimosso l'orfano `pi_booking_token.py` dal deploy, ora allineato al sorgente).
- `erpv6_api_gateway/__manifest__.py`: dipendenza `'erpv6_booking'` → `'aeosv6_booking'`.
- DB: `ir_module_module.name`, 59 righe `ir_model_data.module`, 1 riga `ir_module_module_dependency` (di `erpv6_api_gateway`) aggiornate in transazione.
- `-u aeosv6_booking,erpv6_api_gateway` + restart: nessun errore.

**Verificato dal vivo dopo il rename**: 2 consulenti e 4 token ancora presenti con gli stessi dati; endpoint Next.js `/api/consultant/public-slots?consultantId=1` risponde identico a prima del rename.

## 3. Regola di assegnazione consulente — trovata, non reinventata

`crm_lead.py` (`erpv6_production`) ha già tutto: `_auto_assign_consulente()` (competenza → storico → zona, fallback round-robin con verifica umana), `_set_delivery_consulente()` (scrive `crm.lead.user_id` + riga `erpv6.production.consulente.line` role='delivery'). Girato all'interno di `_promote_to_opportunity()`, alla qualificazione del lead — non alla creazione.

**Nuovo metodo** `erpv6.production.order._resolve_consultant_for_booking()` (in `gate.py`, non un modulo nuovo): legge `self.lead_id.user_id` (già deciso da quella regola), lo mappa a `erpv6.consulting.consultant` via `partner_id` (unico collegamento possibile — nessun link diretto `res.users`→`erpv6.consulting.consultant` esiste sul modello), e garantisce almeno un token `available` non scaduto per quel consulente generandone uno nuovo (validità 90gg) con `erpv6.booking.token.generate_bulk()` — lo stesso metodo già usato dall'endpoint reale `/api/v1/booking/generate`, non un meccanismo nuovo. Se il lead non ha ancora un consulente assegnato, o l'assegnatario non ha un record consulente collegato, ritorna `False` esplicito — mai un consulente indovinato.

## 4. Collegamento pagina report

- `build_and_validate_render_data()` chiama `_resolve_consultant_for_booking()` e aggiunge `consultant_booking_id` al render_data (nuova chiave, non-schema-Typst come `_missing` ecc. — il template PDF non la legge, serve solo all'API/frontend).
- `page.tsx`: `bookingHref = consultant_booking_id ? /booking/<id> : /contatti` — entrambe le CTA ("Parliamone con un consulente" nel box cross-sell, "Prenota una chiamata" nel `BlurLock` per il caso vuoto) ora usano questo link invece del `/contatti` fisso.
- `BlurLock.tsx`: nuova prop `bookingHref` (default `/contatti` se non passata), sostituisce l'`href` hardcoded.

## 5. Verifica end-to-end con dati reali

Usato `erpv6.production.order` #71 (lead #158, caso reale già esistente dal giro precedente). La regola di assegnazione automatica **non ha trovato un match** su questo lead di test (`_auto_assign_consulente()` → `nessun_match_zona`, dato di zona/verticale del test non compatibile con nessuno dei 2 consulenti reali) — comportamento corretto della regola esistente, non un problema del collegamento che sto testando. Per verificare il collegamento ho quindi assegnato il consulente **tramite lo stesso percorso reale di riassegnazione manuale già esistente in produzione** (`_set_delivery_consulente(user, reason='manuale')`, lo stesso chiamato da `erpv6.consulente.reassign.wizard.action_confirm()`), non un meccanismo nuovo o improvvisato:

1. `lead.user_id` → Stefano Puglisi (via riassegnazione manuale, percorso reale).
2. `order._resolve_consultant_for_booking()` → **1** (Stefano Puglisi), token fresco generato (`booking_rF3U5smii6tY3GCevuNxSxFN`, scade 2026-12-05).
3. `order.build_and_validate_render_data()` rieseguito per intero (Motore → Gate 3A → **Gate 3B reale, chiamate AI vere** → RenderDataFinal): `consultant_booking_id: 1` presente nel risultato.
4. Verificato attraverso tutto lo stack reale, non solo lato Odoo: `GET /api/winwin-report/data?token=...` (Next.js locale, porta 3300) → `consultant_booking_id: 1`; `GET /booking/1` → HTTP 200; `GET /api/consultant/public-slots?consultantId=1` → il token fresco compare con `expires_at` corretto.

Non ri-testato il caso "nessun consulente assegnato" con una richiesta HTTP reale in questo giro (verificato solo per lettura del codice: `bookingHref` cade su `/contatti` se `consultant_booking_id` è `False`/assente) — comportamento semplice e a basso rischio, non l'ho ritenuto necessario ripetere il test completo del Gate 3B (alcuni minuti) solo per questo ramo.

## Chiarimento richiesto: il booking fissa un orario sul calendario?

**No.** Letto `apps/impresa/src/app/booking/[consultantId]/page.tsx`: il modello `erpv6.booking.token` non ha campi data/ora, è un link monouso con sola scadenza. Il flusso reale è:
1. Il cliente apre `/booking/<id>`, vede "Call con [Consulente] — valido fino al [scadenza]" (non uno slot orario).
2. Compila nome/email/telefono/note, conferma.
3. `POST /api/booking` salva questi dati sul token in Odoo; la pagina mostra "Richiesta Inviata! Il consulente ti ricontatterà a breve... per fissare l'orario della call."

È quindi una **richiesta di contatto con scadenza**, non una prenotazione calendarizzata — nessuna scelta di giorno/ora, nessuna integrazione Google Calendar/simili. L'orario esatto lo concorda poi il consulente direttamente col cliente. Se in futuro serve un vero calendario con slot orari, è un lavoro aggiuntivo separato (nuovo modello con data/ora + eventuale integrazione calendario esterno) — oggi non esiste, né in `aeosv6_booking` né altrove nel progetto.

## Debito tecnico esplicito

- **Nuovo**: `_resolve_consultant_for_booking()` genera un token con validità fissa a 90 giorni via costante nel codice (`24 * 90`) — ragionevole per coprire il caso "email aperta tardi", ma non configurabile da KB/dato come il resto del circuito. Minore, coerente con la scala del problema.
- **Confermato invariato**: tutti i debiti già noti dai report precedenti (generativo non deterministico sulle win-win, pagamento mock, nessun test browser reale, timing Gate 3B su pochi campioni).
- **Nota per l'uso reale**: la regola di assegnazione automatica esistente richiede dati di zona/verticale compatibili con almeno un consulente reale per trovare un match — su lead con questi dati assenti/incompatibili (come il caso di test), oggi cade nel fallback "verifica manuale", e senza quella verifica manuale il report Win-Win mostrerebbe `/contatti` invece del booking diretto. Non è un difetto del collegamento appena fatto, ma una conseguenza a valle di come funziona già la regola di assegnazione: da tenere presente se in produzione capitano molti casi così.

## File toccati (branch `feature/circuito-winwin-renderdata`, nessun commit, nessun push)

- **Rinominato**: `odoo-modules/erpv6_booking/` → `odoo-modules/aeosv6_booking/`, stesso in `/opt/erpv6/custom-addons/` (con `pi_booking_token.py` orfano rimosso dal deploy, allineato al sorgente).
- **Modificati**: `odoo-modules/erpv6_api_gateway/__manifest__.py` (dipendenza rinominata), `odoo-modules/erpv6_winwin_renderdata/__manifest__.py` (+ dipendenza `aeosv6_booking`), `odoo-modules/erpv6_winwin_renderdata/models/gate.py` (+ `_resolve_consultant_for_booking()`, + `consultant_booking_id` nel render_data) — copiati anche in `/opt/erpv6/custom-addons/`.
- **Frontend**: `apps/impresa/src/lib/winwin/report-client.ts` (+ campo tipo), `apps/impresa/src/app/report/[token]/page.tsx` (+ `bookingHref`, entrambe le CTA aggiornate), `apps/impresa/src/components/shared/BlurLock.tsx` (+ prop `bookingHref`), `apps/impresa/src/app/api/consultant/public-slots/route.ts` (solo commento aggiornato).
- Nessun file di altri thread di lavoro toccato (verificato `git status` prima/dopo — tutte le modifiche pre-esistenti non correlate restano intatte e invariate).
- Dati di test modificati: `crm.lead` #158 (`user_id` ora Stefano Puglisi, era OdooBot — riassegnazione di test tramite il wizard reale, reversibile), 1 nuovo `erpv6.booking.token` per il consulente 1.

## Comandi per aprire questo report

```bash
cat /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_BOOKING.md
```
oppure
```bash
less /home/erpv6admin/erpv6-src/CIRCUITO_WINWIN_RENDERDATA_BOOKING.md
```
