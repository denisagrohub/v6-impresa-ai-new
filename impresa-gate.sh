#!/usr/bin/env bash
# quality gate: tsc, lint, build, scansione vincoli. Dopo ogni task.
set -e
cd /home/erpv6admin/erpv6-src/apps/impresa

echo "[1/4] TypeScript"
npx tsc --noEmit || { echo "GATE FALLITO: TypeScript"; exit 1; }

echo "[2/4] Lint"
echo "INFO: lint dedicato saltato - next build esegue gia lint + type-check interno"

echo "[3/4] Build"
npm run build || { echo "GATE FALLITO: build"; exit 1; }

echo "[4/4] Vincoli sezione 7"
FAIL=0

grep -rEn "350\+|45\s*M|98\s*%" src/app src/components 2>/dev/null && { echo "GATE FALLITO: possibili statistiche finte, controlla le righe sopra"; FAIL=1; }

grep -rni "azienda cliente" src/app/page.tsx 2>/dev/null && { echo "GATE FALLITO: Tosi Mati ancora come azienda cliente, correggi in progetto interno"; FAIL=1; }

grep -rn "metodo-loop-anim" src/components 2>/dev/null >/dev/null || echo "INFO: MetodoLine non ancora usato (normale finche il task 1 non e finito)"

grep -rn "blur" src/app src/components 2>/dev/null | grep -v "opportunit" | grep -v "BlurLock" | grep -v "backdrop" | grep -v "globals.css" && { echo "ATTENZIONE: verifica che nessun blur sia su criticita o azioni_urgenti"; }

if test 0 -eq $FAIL; then echo "GATE SUPERATO: puoi passare al task successivo"; else exit 1; fi