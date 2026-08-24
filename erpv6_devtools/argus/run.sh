#!/usr/bin/env bash
# Avvia Argus da terminale (QA: sola lettura/confronto, MAI scrittura -
# confermato esplicitamente da Denis il 24/08/2026). A differenza di
# Claudio, forza SEMPRE --edit-format ask: e' l'enforcement tecnico nativo
# di Aider per "nessuna modifica file", non solo un'istruzione di persona
# che un modello potrebbe ignorare - messo DOPO "$@" cosi' vince sempre
# anche se qualcuno passasse un altro --edit-format per errore.
#
# Uso: ./erpv6_devtools/argus/run.sh [argomenti extra per aider]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Manca $ENV_FILE (GEMINI_API_KEY, AIDER_MODEL) - vedi erpv6_devtools/argus/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$REPO_ROOT"
exec "$SCRIPT_DIR/.venv/bin/aider" --model "$AIDER_MODEL" "$@" --edit-format ask
