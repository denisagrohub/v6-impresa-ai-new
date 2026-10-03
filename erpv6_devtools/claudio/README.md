# Watcher Claudio — operazioni

Ciclo automatico che applica proposte approvate (erpv6.agent.proposal
con status='accepted') tramite Aider, promuove i moduli Odoo, fa
verificare Argus, e traccia su branch Git.

## Avviare

    cd /home/erpv6admin/erpv6-src/erpv6_devtools/claudio
    nohup python3 watch_proposals.py > watcher.log 2>&1 &

## Fermare

    ps aux | grep watch_proposals | grep -v grep | awk '{print $2}' | xargs kill

## Test dry-run

    python3 watch_proposals.py --once --dry-run

Legge le proposte, valida i path, logga cosa farebbe. Nessun effetto
su Aider, Odoo, Git.

## Cosa fa (flusso completo)

1. Query proposte `accepted` per agente (claudio, alessandro)
2. **Whitelist check**: se il testo proposta cita path fuori da
   `odoo-modules/` o `apps/impresa/`, skip con notifica.
3. **Working tree check**: se sporco, skip per sicurezza.
4. Aider scrive sul working tree del repo.
5. **Promote**: `safe_exec.sh` + `promote_module.sh` installa su
   Odoo (staging + prod). Richiede `CLAUDIO_APPROVED_PROPOSAL_ID`.
6. **Argus verifica** (sola lettura) il risultato.
7. **Branch tracciabile**: `agent/<code>/<id>`, commit strutturato,
   push su origin, ritorno su main.
8. **Notifica Telegram** a Denis con esito + link al branch.

## Se qualcosa va storto

- **Promote FAIL** → log in `/var/log/odoo/`, indagine Argus
  automatica innescata.
- **Argus FAIL** → verifica manuale consigliata.
- **Branch/commit FAIL** → controllare `git status` manualmente.
  Se Aider ha lasciato modifiche, il working tree sarà sporco:
  decidere se committare manualmente o scartare.

## Path consentiti (whitelist)

- ✅ `odoo-modules/*/`
- ✅ `apps/impresa/`

## Path bloccati

- ❌ `.git/`
- ❌ `erpv6_devtools/`
- ❌ `scripts/`
- ❌ `docs/`
- ❌ `docker-compose.yml`, `package.json`, `turbo.json`
- ❌ `.env`, `.env.local`

## Modifiche recenti

- **03/10/2026 (C5-gate-1a)**: aggiunto whitelist path,
  branch+commit+push tracciabile, dry-run.
- **25/08/2026 (precedente)**: supporto Alessandro, catena
  correzione Argus, riassunto Telegram in italiano semplice.
