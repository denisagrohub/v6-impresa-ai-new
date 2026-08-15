# erpv6_color — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo.

## Modelli esposti

Nessun modello nuovo. Il modulo estende (`_inherit`) `erpv6.brand.project` (definito in `erpv6_brand`) aggiungendo solo il metodo `action_generate_palette`. Coerente col fatto che `security/ir.model.access.csv` contiene solo l'header, senza righe: non serve una nuova access rule perché non c'è un nuovo modello.

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`action_generate_palette(self, disc_profile=None, target=None)`** su `erpv6.brand.project`: cerca una `erpv6.kb` con `kb_type='colori'`, chiama `erpv6.kb.engine.process()` (motore generico definito in `erpv6_kb/models/kb_engine.py`, metodo `_process_colors`), scrive il risultato su `selected_palette`. Se non trova nessuna KB di tipo 'colori' solleva `UserError` esplicito invece di crearne una vuota — comportamento coerente con la regola anti-allucinazione del progetto (segnala il dato mancante invece di inventare un fallback silenzioso... anche se poi in caso di palette vuota RITORNATA dal motore usa comunque un fallback hardcoded a 3 colori, vedi debiti).
- Richiamato solo dal bottone UI "Genera Palette" in `views/brand_project_palette_views.xml` (`type="object"`). Nessun altro modulo lo chiama via codice (verificato con grep incrociato su `odoo-modules/` e `apps/`).

## Punti di estensione noti

- Il modulo è di per sé un punto di estensione: aggiunge comportamento a `erpv6.brand.project` senza modificarne il codice sorgente, usando `_inherit` + vista ereditata con `inherit_id`/`xpath` (pattern corretto, commentato esplicitamente nel file XML: "Vive qui (non in erpv6_brand) perché action_generate_palette è definito in questo modulo, che carica dopo erpv6_brand").
- Rispetta il principio motore/conoscenza del CLAUDE.md: la logica di generazione palette è delegata al motore generico `erpv6.kb.engine`, mentre il contenuto (mappature DISC → palette) vive nei dati della KB (`kb_type='colori'`), non nel codice.
- `disc_profile` e `target` di default sono hardcoded (`'C'` e `'professionisti'`) nel metodo invece che configurabili — piccola rigidità ma non viola l'architettura.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.1.0.0`. Coincide con la versione nel manifest locale — nessun drift.
- Dipende da `erpv6_core`, `erpv6_brand`, `erpv6_kb` (dichiarato nel manifest) — coerente con l'uso reale nel codice.
- Nessuna cartella `tests/`.
- Non è referenziato da nessun altro modulo (nessun modulo dipende da `erpv6_color` in `depends`, nessun controller API lo espone) — è un modulo "foglia", usato solo da UI diretta.

### Debiti noti / TODO

- Nessun test automatico.
- Se `erpv6.kb.engine.process()` ritorna una palette vuota, il metodo usa un fallback hardcoded (`primary: #333333, secondary: #666666, accent: #FF5722`) invece di sollevare un errore come fa nel caso "KB non trovata" — comportamento incoerente: un caso blocca l'utente con errore esplicito, l'altro produce silenziosamente un dato fittizio senza avvisare l'utente in modo bloccante (solo un `_logger.warning`, non visibile a chi usa la UI).
