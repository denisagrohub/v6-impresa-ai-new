# erpv6_booking — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.booking.token` | `token` (Char, generato automaticamente `booking_<24 char casuali>`, unique), `consultant_id` (Many2one `erpv6.consulting.consultant`), `brand_id` (related, store), `status` (Selection: available/booked/expired/cancelled), `client_name/email/phone`, `validity_hours`, `expires_at` (compute) | Modello con logica di business reale, chatter attivo (`mail.thread`) |
| `erpv6.booking.token.generate.bulk.wizard` (TransientModel) | `consultant_id`, `count`, `validity_hours` | Wizard UI per generazione bulk, nessuna logica propria oltre a richiamare il modello principale |
| Estensione `res.partner` | `x_pi_is_consultant`, `x_pi_consultant_brand`, `x_pi_hourly_rate`, `x_pi_max_daily_public_slots` | Campi custom con prefisso `x_pi_` (naming diverso dal resto del progetto, che usa `erpv6_`/nessun prefisso — vedi debiti) |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`action_book()`**, **`action_cancel()`**, **`action_reset()`** su `erpv6.booking.token`: transizioni di stato del token.
- **`generate_bulk(consultant_id, count=10, validity_hours=24)`** (`@api.model`): crea N token in blocco. Richiamato dal wizard `erpv6.booking.token.generate.bulk.wizard`.
- **`cron_expire_tokens()`** e **`cron_cleanup_tokens(days=30)`** (`@api.model`): eseguiti da due `ir.cron` schedulati in `data/cron_data.xml` (ogni ora / ogni giorno).
- **Uso reale confermato da altro modulo**: `erpv6_api_gateway/controllers/booking_api.py` chiama `action_book()` direttamente su un endpoint pubblico `POST /api/v1/booking/book`, e legge/scrive lo stato del token su `POST /api/v1/booking/validate`. Questo è l'unico consumer esterno verificato.

## Punti di estensione noti

- `consultant_id` collega a `erpv6.consulting.consultant` (modulo `erpv6_consulting`, dipendenza dichiarata nel manifest) — non è un motore generico con link `res_model`/`res_id`, è specifico del dominio "consulenza". Coerente: questo modulo non è pensato come motore a-settoriale, è una feature verticale specifica (prenotazioni consulenti), quindi non è tenuto a rispettare il pattern generico.
- Il prefisso `x_pi_` sui campi aggiunti a `res.partner` è incoerente con la convenzione `erpv6_`/senza prefisso usata nel resto del progetto — sembra un residuo di un naming precedente ("PI" = probabilmente "Progetto Impresa", brand hardcoded anche nel default `x_pi_consultant_brand='progetto-impresa'`).

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.1.0.0`. Coincide con la versione nel manifest locale — nessun drift.
- Consumer esterno reale confermato: `erpv6_api_gateway` (endpoint REST `/api/v1/booking/validate` e `/api/v1/booking/book`), quindi il modulo non è solo teorico — è esposto pubblicamente via API (`auth='none'`, protetto presumibilmente a livello applicativo dal token stesso, non da autenticazione Odoo).
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Bug reale verificato**: `booking_token.py` usa `UserError` in tre punti (`action_book`, `action_cancel`) ma **non lo importa** — l'import in cima al file è solo `from odoo import api, fields, models, _`, manca `from odoo.exceptions import UserError`. Il percorso di errore (es. token non disponibile, token scaduto) solleverebbe un `NameError` invece di un `UserError` pulito. Questo percorso è raggiungibile anche dall'endpoint pubblico `/api/v1/booking/book` in `erpv6_api_gateway`.
- Endpoint `/api/v1/booking/book` e `/api/v1/booking/validate` hanno `auth='none'` — nessuna autenticazione Odoo, la sicurezza si basa solo sulla segretezza del token generato. Non è necessariamente un bug (è il pattern standard per booking token pubblici), ma va tenuto presente come superficie di attacco se il token è indovinabile o loggato altrove.
- Naming incoerente `x_pi_*` su `res.partner` (vedi sopra).
- Nessun test automatico.
