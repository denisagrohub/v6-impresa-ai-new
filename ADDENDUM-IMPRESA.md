# ADDENDUM - Redesign Impresa (feature/impresa-redesign-v3)

Creato: 2026-09-03. Aggiornare ad ogni decisione o passo completato.

## CONTESTO
- Repo: denisagrohub/v6-impresa-ai-new (alias SSH: github-erpv6, chiave ~/.ssh/erpv6_deploy_key)
- Branch di lavoro: feature/impresa-redesign-v3 (da feature/landing-premium-refit)
- Backup sorgente: /home/erpv6admin/backup_impresa_src.tar.gz
- Rollback: bash impresa-rollback.sh (ripristina branch di partenza)
- Vincolo: token Claude limitati -> task ridotti al minimo, correzioni a mano quando possibile

## CICLO OPERATIVO
1. Terminale 1 (Claude Code): "leggi ed esegui .claude-tasks/TASK-x-...md"
2. Terminale 2: bash impresa-gate.sh
3. Se GATE FALLITO: incollare errore a Claude ("correggi solo, non rilanciare il gate")
4. Se GATE SUPERATO: test manuale (se previsto) -> commit -> task successivo

## FATTO (cronologia)
- [fatto] Fix SSH: alias github-erpv6 aggiunto a ~/.ssh/config (era sparito, bloccava fetch/push)
- [fatto] impresa-setup.sh: backup, branch, token, componenti shared (MetodoLine ecc.)
- [fatto] impresa-tasks.sh: 5 task generati in .claude-tasks/
- [fatto] TASK-1 (home redesign): fatto, commit a6027a0
- [fatto a mano, 0 token] Bonifica 12 errori TypeScript pre-esistenti
  (admin/actions, admin/circuit, admin/graph, graph-test, EosGraph)
- [fatto a mano, 0 token] Rimozione statistiche finte: 98% in premium/page.tsx e chi-siamo/page.tsx
- [fatto] impresa-gate.sh: 4 fasi (tsc, lint, build, vincoli sezione 7)
- [fatto] Pulizia file .bak dal commit

## DECISIONI TECHNICHE
- Gate lint dedicato SALTATO: il progetto ha eslint.config.mjs (flat config, ESLint 9)
  ma node_modules ha ESLint 8 -> incompatibili. "next lint" apre wizard interattivo
  se non trova .eslintrc classico (NON usare next lint in script non interattivi!).
  Copertura garantita: next build esegue gia lint + type-check interni.
  DA FARE dopo il push: upgrade ESLint 9 o downgrade config.
- Correzioni minimali: mai refactoring di passaggio, mai file extra, mai .bak
  (l'originale e in git).

## VINCOLI SEZIONE 7 (verificati dal gate)
- Vietate statistiche non verificabili (98%, 350+, 45M) -> il gate le cerca con grep
- Tosi Mati non come "azienda cliente" (progetto interno)
- Blur vietato su criticita/azioni_urgenti (blob decorativi ok)


## OBIETTIVI DI CONTENUTO (il PERCHE dei task)
- TASK-2 intervista: bug funzionale reale - l'opzione "Altro" nell'intervista
  non funziona; il dato deve arrivare pulito fino a Odoo. Piu importante di tutti.
- TASK-3 attesa/output: [COMPLETARE - vedi TASK-3-attesa-output.md]
- TASK-4 circuiti (admin/circuit/page.tsx): [COMPLETARE - vedi TASK-4-circuit.md]
  Il circuit e il cuore del core-engine: fasi -> nodi -> processi, con DAG
  (dagre/react-force-graph) e collegamento a /api/core-engine/*. Riscrittura
  CONSIDERATA RIDOTTA per budget token: solo cio che il task file indica.
  NOTA: nel commit a6027a0 e finito un page.tsx.bak di 1851 righe del circuit:
  verifica che il TASK-4 non abbia toccato il circuit prima del suo turno.
- TASK-5 pagine: secondario, skip probabile.

## PROSSIMI PASSI
1. TASK-2 (intervista, bug "Altro"): TASK PIENO - il piu importante
   - prompt con vincoli: solo file del task, no esplorazione, no gate/build da Claude
   - dopo gate: TEST MANUALE localhost:3000/intervista opzione "Altro"
   - commit SOLO dopo test manuale ok
2. TASK-3 (attesa/output): RIDOTTO al minimo - solo messaggio finale, no animazioni
3. TASK-4 (circuit): RIDOTTO - solo modifiche indicate, no lettura contesto extra
4. TASK-5 (pagine): PROBABILE SKIP - si riprende in secondo giro se servono token
5. PUSH del branch + PR
6. Casa da sistemare dopo il push (non urgente):
   - upgrade ESLint 9 + config flat, riattivare lint nel gate
   - runbook SSH (NOTES-SSH.md) per la config .ssh che si e persa una volta
   - valutare config ESLint condivisa nel repo

## REGOLE BUDGET TOKEN
- Prompt secco: solo file indicati dal task, no esplorazione
- Vietati riassunti lunghi: max 5 righe di resoconto
- Gate e build SEMPRE a mano (terminale 2), mai da Claude
- Dubbi/analisi: chiedere fuori da Claude o leggere git diff direttamente
