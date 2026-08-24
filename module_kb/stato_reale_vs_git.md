# Stato reale VPS↔repo — bussola per Claudio

Ogni voce: modulo/file, stato, data di verifica, prossima riverifica
consigliata. Un dato senza data di verifica non va mai trattato come vero
adesso — solo com'era in quella data. Claudio deve rileggere questo file ad
ogni sessione (`.aider.conf.yml`), ma NON fidarsene per azioni con effetto
reale senza riverificare live se la data è vecchia.

## erpv6_typst — generazione PDF
- Stato: RICONCILIATO — `typst_document.py` genera il PDF compilando
  davvero il sorgente Typst via `subprocess.run` (riga 142), non uno stub.
- Verificato il: 2026-08-24 (rigrep diretto, riconferma di un claim del
  23/08/2026 nel piano Claudio/Argus)
- Prossima riverifica: prima di ogni `promote_module.sh` su questo modulo

## erpv6_api_gateway — bug `hasattr(request.env, ...)`
- Stato: PARZIALMENTE CORRETTO — 2 controller ancora affetti:
  `project_api.py` (riga 60), `saas_vertical_api.py` (righe 30, 71).
  `sign_api.py` già corretto (`in request.env`, vedi
  `module_kb/known_errors/hasattr_request_env.md`).
- **Correzione a un claim del piano Claudio/Argus del 23/08/2026**: quel
  documento affermava "saas_tenant_api.py non esiste più nel repo" — FALSO,
  verificato il 24/08/2026: esiste (`odoo-modules/erpv6_saas/controllers/
  saas_tenant_api.py`) e usa già il pattern corretto (`not in request.env`,
  righe 23/79). Non è un terzo file affetto, ma il documento aveva comunque
  torto sulla sua esistenza — esempio reale di quanto in fretta un documento
  "verificato" invecchi, prova diretta della disciplina che questo stesso
  file cerca di imporre.
- Verificato il: 2026-08-24, grep diretto su tutti e 19 i controller di
  `erpv6_api_gateway` + il controller `erpv6_saas/controllers/saas_tenant_api.py`
- Prossima riverifica: prima di correggere `project_api.py`/`saas_vertical_api.py`

## DOCUMENTAZIONE_ANALISI_COMPLETA.md (root repo)
- Stato: FABBRICATO, confermato di nuovo — `_index_specs`, `queue_job`,
  cache Redis citati nel file non hanno NESSUN riscontro reale nel codice
  (`grep -rl` su tutto `odoo-modules/` per questi tre nomi: zero risultati).
- Verificato il: 2026-08-24
- Azione consigliata: non fidarsi di questo file per nessun claim tecnico,
  non ancora rimosso dalla root del repo.

## apps/impresa — /login
- Stato: PROBLEMA REALE, ancora presente — credenziali hardcoded in chiaro
  in `apps/impresa/src/app/login/page.tsx` (admin@progettoimpresa.it/admin123,
  demo@.../demo123, christian@.../consultant123) mostrate come suggerimento
  visibile in UI; `apps/impresa/src/app/admin/login/page.tsx` ha
  `admin`/`admin` hardcoded.
- Verificato il: 2026-08-24 (grep diretto sul file)
- Priorità: alta, segnalato a Denis la sera del 24/08/2026, fix non ancora
  eseguito.
