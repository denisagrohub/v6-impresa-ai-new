#!/usr/bin/env bash
# Avvia Claudio da terminale, come si avvia Claude Code: attiva il
# virtualenv dedicato, carica il modello/chiave da erpv6_devtools/claudio/.env
# (mai committato, vedi .gitignore), e lancia Aider dalla root del repo
# (cosi' .aider.conf.yml, CLAUDE.md, module_kb/ vengono trovati e caricati
# automaticamente come contesto obbligatorio).
#
# Uso: ./erpv6_devtools/claudio/run.sh [argomenti extra per aider]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Manca $ENV_FILE (GROQ_API_KEY, AIDER_MODEL) - vedi erpv6_devtools/claudio/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$REPO_ROOT"
# --map-tokens 512: il default (4096) da solo quasi saturava il tetto di
# 8000 token/minuto del piano gratuito Groq (verificato dal vivo il
# 24/08/2026 su un compito reale, fallito per rate limit) - la mappa
# repository serve per orientarsi su un codice sconosciuto, non e' cosi'
# critica per compiti piccoli e mirati come quelli di Claudio.
#
# --edit-format diff: il default di Aider per questo modello e' "whole"
# (riscrive SEMPRE il file intero ad ogni modifica, anche per una riga) -
# trovato il 24/08/2026 rileggendo .aider.chat.history.md dopo che la
# proposta #13 (aggiungere una riga a sign_api.py, file piu' lungo degli
# altri) ha esaurito di nuovo il tetto token proprio perche' Aider stava
# per riscrivere l'intero file solo per una riga. "diff" fa scrivere solo
# le righe cambiate, molto piu' economico - stessi fix precedenti (righe
# piu' corte) avevano funzionato per puro caso restando sotto soglia.
exec "$SCRIPT_DIR/.venv/bin/aider" --model "$AIDER_MODEL" --map-tokens 512 --edit-format diff "$@"
