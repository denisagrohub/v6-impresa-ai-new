# Proposte di fix — 11 controller gateway rimasti (bloccati / codice morto)

**Data**: 2026-08-13
**Stato**: lavoro in corso, salvataggio incrementale — un controller alla volta, commit dopo ognuno.
**Tipo**: Solo proposta di correzione (codice completo nel documento). Nessuna modifica applicata ai controller reali, nessuna promozione in `/opt/erpv6/custom-addons`.

Contesto: prosegue l'audit di `docs/gateway-promotion-readiness-2026-08-13.md` (14 controller mai promossi). Di quei 14: `file_api.py`/`user_api.py` già promossi oggi, `tracking_api.py` promosso oggi separatamente (vedi commit `5daea8a` — l'audit lo dava per "pulito" ma conteneva in realtà il bug hasattr, corretto). Restano questi 11, qui solo analizzati e proposti, non applicati:

## Indice

1. [ ] `accounting_api.py` — bug hasattr (nessuna dipendenza mancante)
2. [ ] `bandi_api.py` — bug hasattr + `erpv6_bandi` non in depends
3. [ ] `methodology_api.py` — bug hasattr + `erpv6_methodology` non in depends
4. [ ] `saas_tenant_api.py` — bug hasattr (dipendenza già ok)
5. [ ] `saas_vertical_api.py` — bug hasattr + rotta duplicata con `saas_api.py`
6. [ ] `validation_api.py` — bug hasattr + `erpv6_validation` non in depends
7. [ ] `library_api.py` — bug hasattr + `erpv6_library` non in depends + campo `file_id` inesistente
8. [ ] `partner_api.py` — modello `ateco.at` inesistente + campi `ateco_code`/`fiscal_regime` inesistenti
9. [ ] `project_api.py` — `crm.lead.contact_email` inesistente (crash 500) + bug hasattr parziale
10. [ ] `saas_api.py` — dipendenza circolare di manifest (decisione di design, non solo fix meccanico)
11. [ ] `sign_api.py` — bug hasattr + `erpv6_sign` non in depends + 6 mismatch di campo/comodel

Ogni voce sopra viene marcata `[x]` e la sezione corrispondente viene aggiunta in append qui sotto, subito dopo aver completato l'analisi di quel controller — mai tutte insieme alla fine.

---
