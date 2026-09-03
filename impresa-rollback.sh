#!/usr/bin/env bash
# rollback: torna al branch di partenza ed elimina il branch di lavoro
set -e
cd /home/erpv6admin/erpv6-src

# Recupera il branch di origine se salvato durante il setup, altrimenti usa il fallback
ORIGIN_BRANCH=$(cat /tmp/impresa_origin_branch 2>/dev/null || echo "feature/core-engine-adaptive-eosv6")

echo "Ritorno al branch: $ORIGIN_BRANCH"
git checkout "$ORIGIN_BRANCH"

echo "Eliminazione branch di lavoro..."
git branch -D feature/impresa-redesign-v3

echo "Rollback completato con successo."
echo "I file sorgenti originali sono ripristinabili da: /home/erpv6admin/backup_impresa_src.tar.gz"