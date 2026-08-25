#!/usr/bin/env bash
# Avvia Alessandro da terminale (25/08/2026, costruzione dell'agente di
# escalation -- vedi memoria project_alessandro_agent_design.md) -- gemello
# di erpv6_devtools/claudio/run.sh, stesso motore (Aider), stesso virtualenv
# (link simbolico a claudio/.venv, stesso schema gia' usato da argus/run.sh:
# UN SOLO venv reale per tutti gli agenti Aider, mai reinstallato tre
# volte), carica il modello/chiave da erpv6_devtools/alessandro/.env (mai
# committato, vedi .gitignore).
#
# Differenza rispetto a Claudio (Alessandro ha "strumenti piu' ampi": prima
# di editare, deve capire DAVVERO dove intervenire, non solo applicare un
# diff su un file gia' nominato): --map-tokens piu' alto (1024 contro 512
# di Claudio) per una mappa del repository piu' ricca durante la ricerca --
# tenuto comunque moderato, non il default 4096, perche' condivide lo
# stesso budget Groq free-tier di Claudio (nessuna chiave dedicata ancora
# emessa: erpv6_devtools/alessandro/.env riusa oggi le stesse credenziali
# di Claudio, vedi commento nel file -- va sostituito con una chiave
# propria se il volume di escalation cresce).
#
# Uso: ./erpv6_devtools/alessandro/run.sh [argomenti extra per aider]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Manca $ENV_FILE (GROQ_API_KEY, AIDER_MODEL) - vedi erpv6_devtools/alessandro/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$REPO_ROOT"
# --edit-format diff: stesso motivo di Claudio (vedi run.sh di Claudio) --
# scrivere solo le righe cambiate resta piu' economico anche per Alessandro,
# indipendentemente dal fatto che la sua ricerca iniziale sia piu' ampia.
exec "$SCRIPT_DIR/.venv/bin/aider" --model "$AIDER_MODEL" --map-tokens 1024 --edit-format diff "$@"
