#!/usr/bin/env bash
# Wrapper di sicurezza OBBLIGATORIO per qualunque comando reale (scrittura
# file/DB, esecuzione shell) che Claudio (Aider) esegue fuori dalla semplice
# lettura del repo. Non un file di istruzioni che un modello free-tier
# potrebbe ignorare: un vero punto di applicazione tecnica.
#
# Perche' esiste (CLAUDE.md, regole non negoziabili del progetto erpv6):
# - fattorie_della_fenice e' un database di PRODUZIONE ATTIVO, mai da
#   toccare in nessuna circostanza, da nessun agente.
# - Mai push su main senza conferma esplicita di Denis.
# - Nessuna azione con effetto reale senza il gate umano (una
#   erpv6.agent.proposal approvata da Denis prima dell'apply).
#
# Uso: ./safe_exec.sh "<comando completo da eseguire>"
# Ritorna 1 e NON esegue nulla se il comando matcha un pattern vietato.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 \"<comando>\"" >&2
  exit 2
fi

CMD="$*"

refuse() {
  echo "RIFIUTATO da safe_exec.sh: $1" >&2
  echo "Comando bloccato: $CMD" >&2
  echo "Vedi CLAUDE.md (regole non negoziabili del progetto erpv6) per il motivo." >&2
  exit 1
}

# --- fattorie_della_fenice: MAI, in nessuna forma, case-insensitive ---
if echo "$CMD" | grep -qiE "fattorie_della_fenice|fattorie.della.fenice"; then
  refuse "menzione/accesso a fattorie_della_fenice (database di produzione attivo, intoccabile)"
fi

# --- push diretto su main/master, con o senza force ---
if echo "$CMD" | grep -qiE "git[[:space:]]+push[[:space:]]+.*[[:space:]](main|master)([[:space:]]|$)"; then
  refuse "push diretto su main/master senza conferma esplicita di Denis in questa sessione"
fi
if echo "$CMD" | grep -qiE "git[[:space:]]+push[[:space:]]+.*--force"; then
  refuse "force push (mai automatico, richiede conferma esplicita separata)"
fi

# --- comandi distruttivi generici, mai automatici ---
if echo "$CMD" | grep -qiE "rm[[:space:]]+-rf[[:space:]]+/($|[[:space:]])|docker[[:space:]]+system[[:space:]]+prune|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+clean[[:space:]]+-f"; then
  refuse "comando distruttivo generico, richiede sempre un umano al comando, mai Claudio in autonomia"
fi

# --- promote_module.sh: consentito SOLO se chi chiama dichiara
#     esplicitamente da quale erpv6.agent.proposal approvata deriva
#     l'azione (variabile d'ambiente CLAUDIO_APPROVED_PROPOSAL_ID) - non
#     un'euristica sul testo del comando, un vincolo di contesto reale. ---
if echo "$CMD" | grep -qE "promote_module\.sh"; then
  if [ -z "${CLAUDIO_APPROVED_PROPOSAL_ID:-}" ]; then
    refuse "promote_module.sh richiede CLAUDIO_APPROVED_PROPOSAL_ID valorizzato (id di una erpv6.agent.proposal gia' approvata da Denis) - nessuna promozione senza gate umano tracciabile"
  fi
fi

echo "safe_exec.sh: comando ammesso, eseguo." >&2
bash -c "$CMD"
STATUS=$?
echo "" >&2
echo ">>> Hai appena scritto/modificato qualcosa. Regola di Denis (24/08/2026): qualunque scrittura, anche minima, richiede una voce nel registro (${HOME}/.claude/projects/-home-erpv6admin-erpv6-src/memory/project_claudio_argus_activity_log.md) e un lancio di erpv6_devtools/agent_log_sync.py prima di chiudere. Sola lettura non lo richiede." >&2
exit $STATUS
