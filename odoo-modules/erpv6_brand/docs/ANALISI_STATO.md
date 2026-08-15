# erpv6_brand — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.brand.project` | `name`, `partner_id` (Many2one res.partner), `lead_id` (Many2one crm.lead), `status` (Selection: draft/candidates_generated/selected/finalized, con `tracking=True`), `selected_name`, `selected_palette` (Json) | Modello con logica di workflow reale (statusbar), eredita `mail.thread`/`mail.activity.mixin` (chatter attivo) |

Solo un modello, nessuna anagrafica di supporto.

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`action_finalize()`** su `erpv6.brand.project`: valida che `status == 'selected'` e passa a `finalized`. Chiamato dal bottone "Finalizza" in `views/brand_views.xml` (`type="object"`). Nessun altro modulo lo richiama via codice — uso solo da UI.
- Nessun altro metodo pubblico definito in questo modulo. La generazione della palette (`action_generate_palette`) è definita nel modulo `erpv6_color`, non qui — vedi `docs/ANALISI_STATO.md` di `erpv6_color`.

## Punti di estensione noti

- Il modello `erpv6.brand.project` è pensato per essere esteso da altri moduli via `_inherit` (pattern già usato da `erpv6_color`, che aggiunge `action_generate_palette` senza toccare questo modulo). Coerente con la separazione motore/estensione voluta dal progetto.
- `status` è una Selection hardcoded a 4 valori: workflow lineare fisso, non parametrizzabile senza modifica codice — corretto per un workflow di business specifico (non è un "motore generico" da riusare su verticali diversi, quindi non è un problema architetturale).
- Referenziato (`_inherit` o lettura diretta) da `erpv6_color`, `erpv6_marketing` (`logo_generator.py`, `marketing.py`), `erpv6_library` (`brand_project.py`, `library_document.py`), `erpv6_whitelabel` (`mail_template_patch.py`) — è un modello centrale, usato trasversalmente da più moduli downstream.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.1.0.0`. Coincide con la versione nel manifest locale (`18.0.1.0.0`) — nessun drift.

- Access rights: utente standard ha solo `perm_read=1` (nessun write/create/unlink), solo `base.group_system` può modificare — workflow controllato, coerente con lo stato "Finalizzato" che dovrebbe essere protetto da modifiche accidentali.
- Nessuna cartella `tests/`.
- Modulo centrale per altri 4 moduli (color, marketing, library, whitelabel) che lo referenziano — uso reale confermato indirettamente dal numero di dipendenti, anche se non è stato verificato il conteggio righe in tabella (escluso per questo batch).

### Debiti noti / TODO

- Nessun test automatico.
- Nessun metodo per tornare indietro nel workflow (da `finalized` non si può regredire) — se è voluto, andrebbe documentato nel modello stesso; se non è voluto, è un gap. Segnalato come comportamento da chiarire, non un bug certo.
