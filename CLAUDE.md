# CLAUDE.md — Progetto erpv6 (AgroHub / Fattoria ai Tosi Mati / V6 Impresa)

Questo file viene letto automaticamente da Claude Code ogni volta che lavora in questa cartella. Definisce le regole non negoziabili del progetto.

## Struttura del repository

```
odoo-modules/          ← moduli erpv6_*, zona di sviluppo (qui lavori)
apps/                  ← frontend Next.js multi-brand (Turborepo), deploy automatico su Vercel al push
```

**Attenzione al push su GitHub**: questo repo triggera un deploy automatico su Vercel per il frontend. Non fare `git push` su `main` senza che l'utente lo confermi esplicitamente — lavora sempre su branch dedicati (`feature/<nome-task>`), mai commit diretti su `main`.

## Principi architetturali del progetto (non violare senza conferma esplicita)

- **Motore vs conoscenza**: Pareto/Kairós/5S sono motori generici e a-settoriali (`erpv6_methodology`), riusabili da qualsiasi verticale. Le regole specifiche di settore vanno in categorie `erpv6_kb` con campo `verticale` valorizzato, mai duplicate come nuovo codice.
- **`erpv6_kaizen` non parla mai direttamente con `erpv6_bandi`** — passa sempre da `erpv6_opportunity` come orchestratore.
- **Proposte Kaizen legate a CCP o fiscalità** (`is_ccp_related=True`) richiedono sempre passaggio da `erpv6_validation` (6 Giudici) e revisione umana finale — non possono mai auto-applicarsi.
- **`erpv6_validation`** ha `max_rounds` di sicurezza (default 5) — se non converge, stato `escalated_to_human`, mai loop infinito.
- Prima di creare un nuovo modello/modulo, verifica se esiste già un motore generico riusabile (vedi `erpv6_architettura_riepilogo.md` nella root del progetto) — non duplicare.

## Cosa fare se qualcosa non è chiaro

Se una specifica manca o è ambigua, fermati e chiedi — non inventare un comportamento plausibile. Il progetto ha una regola esplicita anti-allucinazione (`flagged_missing_data`) che vale anche per il lavoro di sviluppo, non solo per i contenuti generati.
