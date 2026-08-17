#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# promote_module.sh — Promuove un modulo erpv6 da ~/erpv6-src
# a custom-addons SOLO se Odoo lo installa/aggiorna senza errori
# sul database di staging.
#
# Uso: ./promote_module.sh erpv6_kb [erpv6_bandi ...]
#
# ============================================================

# --- VALORI CONFERMATI SUL VPS ERPV6 (audit 11/08/2026) ---
SRC_DIR="$HOME/erpv6-src/odoo-modules"        # clone git, zona di sviluppo
CUSTOM_ADDONS_DIR="/opt/erpv6/custom-addons"   # cartella letta da Odoo (produzione), NON /mnt/extra-modules
DOCKER_COMPOSE_DIR="/opt/erpv6"
ODOO_SERVICE_NAME="odoo"
ODOO_CONF_PATH="/etc/odoo/odoo.conf"           # path del config DENTRO il container (persistito su ./config sull'host)
STAGING_DB="erpv6"                             # database usato oggi come test/staging (NON fattorie_della_fenice)
PROD_DB="erpv6"                                # AGGIORNARE quando esisterà un vero database di produzione separato da staging
# -------------------------------------------------------------
#
# NOTE IMPORTANTI (imparate sul campo l'11/08/2026, non ignorare):
# 1. La password del database (db_password) va cambiata dentro
#    /opt/erpv6/config/odoo.conf, NON nel file .env — Odoo legge
#    il valore da odoo.conf una volta scritto, e ignora la variabile
#    d'ambiente se odoo.conf ha già un valore esplicito.
# 2. Dopo aver cambiato una variabile in .env, "docker compose restart"
#    NON basta — non rilegge .env. Serve "docker compose up -d --force-recreate".
# 3. MAI usare "docker compose config" per verificare una variabile:
#    stampa i secrets in chiaro nell'output. Per controllare una password
#    senza esporla, usare solo controlli di lunghezza, es.:
#    grep VARIABILE file | awk -F= '{print length($2)}'

# --- GUARDIA DI SICUREZZA PERMANENTE ---
# Blocca qualsiasi comando di questo script che tenti di operare sul
# database di produzione reale "fattorie_della_fenice". Indipendente
# dalle variabili sopra: controlla il valore effettivo passato a -d
# in ogni punto in cui questo script tocca un database, così resta
# efficace anche se STAGING_DB o PROD_DB venissero modificati per errore.
check_db_safety() {
  local db="$1"
  if [ "$db" = "fattorie_della_fenice" ]; then
    echo "" >&2
    echo "❌ BLOCCATO: tentativo di operare sul database 'fattorie_della_fenice'." >&2
    echo "Questo è un database di PRODUZIONE ATTIVA (rete d'impresa agricola, dati reali)." >&2
    echo "promote_module.sh non deve mai toccarlo, in nessuna circostanza. Esecuzione interrotta." >&2
    exit 1
  fi
}

if [ "$#" -eq 0 ]; then
  echo "Uso: $0 <nome_modulo> [<nome_modulo_2> ...]"
  exit 1
fi

# --- Classificazione moduli: nuovi (mai installati) vs già installati ---
# Odoo -u aggiorna SOLO moduli già in stato 'installed'/'to upgrade' (vedi
# odoo/modules/loading.py: la query filtra esplicitamente su questi stati).
# Se un modulo è 'uninstalled' o assente da ir_module_module, -u non fa NULLA
# e non genera errore: lo script uscirebbe con "successo" senza aver
# installato nulla. Per questo separiamo chi va con -i (install) da chi va
# con -u (update), invece di passare tutto sempre con -u.
classify_modules() {
  local db="$1"; shift
  local modules="$*"
  TO_INSTALL=()
  TO_UPDATE=()
  for module in $modules; do
    local state
    state=$(docker compose exec -T postgres \
      psql -U odoo -d "$db" -t -A -c "SELECT state FROM ir_module_module WHERE name='$module';" < /dev/null | tr -d '[:space:]')
    if [ "$state" = "installed" ] || [ "$state" = "toupgrade" ]; then
      TO_UPDATE+=("$module")
    else
      TO_INSTALL+=("$module")
    fi
  done
}

build_odoo_args() {
  local db="$1"
  ODOO_ARGS=(-c "$ODOO_CONF_PATH" -d "$db")
  if [ ${#TO_INSTALL[@]} -gt 0 ]; then
    ODOO_ARGS+=(-i "$(IFS=,; echo "${TO_INSTALL[*]}")")
  fi
  if [ ${#TO_UPDATE[@]} -gt 0 ]; then
    ODOO_ARGS+=(-u "$(IFS=,; echo "${TO_UPDATE[*]}")")
  fi
  ODOO_ARGS+=(--stop-after-init)
}

MODULES="$*"
MODULES_CSV=$(echo "$MODULES" | tr ' ' ',')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="/tmp/promote_${TIMESTAMP}.log"
BACKUP_ROOT="/tmp/promote_backup_${TIMESTAMP}"

echo "=== Step 1 — Backup e copia in custom-addons ==="
echo "Moduli: $MODULES_CSV"
echo "Log completo: $LOGFILE"
echo ""

cd "$DOCKER_COMPOSE_DIR"

check_db_safety "$STAGING_DB"

# Copiamo PRIMA di verificare (non dopo): Odoo legge solo da custom-addons,
# quindi testare un modulo che non è ancora lì produce solo un WARNING
# "invalid module names, ignored" e uno pseudo-successo senza aver installato
# nulla (imparato sul campo il 12/08/2026 con erpv6_methodology). Ogni
# modulo già presente viene salvato in backup prima di essere sovrascritto,
# così un fallimento nella verifica può essere annullato con un rollback.
declare -A EXISTED_BEFORE
for MODULE in $MODULES; do
  if [ ! -d "$SRC_DIR/$MODULE" ]; then
    echo "⚠️  $MODULE non trovato in $SRC_DIR — salto."
    continue
  fi
  if [ -d "$CUSTOM_ADDONS_DIR/$MODULE" ]; then
    EXISTED_BEFORE["$MODULE"]=1
    mkdir -p "$BACKUP_ROOT"
    echo "→ Backup versione esistente di $MODULE in $BACKUP_ROOT/$MODULE ..."
    rsync -a --delete "$CUSTOM_ADDONS_DIR/$MODULE/" "$BACKUP_ROOT/$MODULE/"
  else
    EXISTED_BEFORE["$MODULE"]=0
  fi
  echo "→ Copio $MODULE in custom-addons..."
  rsync -a --delete "$SRC_DIR/$MODULE/" "$CUSTOM_ADDONS_DIR/$MODULE/"
done

rollback() {
  echo ""
  echo "↩️  Rollback in corso..."
  for MODULE in $MODULES; do
    case "${EXISTED_BEFORE[$MODULE]:-}" in
      1)
        echo "→ Ripristino versione precedente di $MODULE da $BACKUP_ROOT/$MODULE ..."
        rsync -a --delete "$BACKUP_ROOT/$MODULE/" "$CUSTOM_ADDONS_DIR/$MODULE/"
        ;;
      0)
        echo "→ Rimuovo $MODULE da custom-addons (era nuovo, nessuna versione precedente da ripristinare)..."
        rm -rf "${CUSTOM_ADDONS_DIR:?}/${MODULE:?}"
        ;;
    esac
  done
  echo "custom-addons ripristinato allo stato precedente."
}

echo ""
echo "=== Step 2 — Verifica installazione su staging ($STAGING_DB) ==="

classify_modules "$STAGING_DB" $MODULES
echo "Da installare (-i): ${TO_INSTALL[*]:-nessuno}"
echo "Da aggiornare (-u): ${TO_UPDATE[*]:-nessuno}"
build_odoo_args "$STAGING_DB"

# Esegue l'installazione/aggiornamento reale su Odoo, contro il DB di staging.
# --stop-after-init: Odoo si ferma dopo aver provato a caricare i moduli,
# non resta acceso. Se un modulo è rotto, Odoo esce con errore/traceback.
set +e
docker compose exec -T "$ODOO_SERVICE_NAME" \
  odoo "${ODOO_ARGS[@]}" \
  < /dev/null > "$LOGFILE" 2>&1
EXIT_CODE=$?
set -e

# Controllo: exit code, Traceback/CRITICAL/ERROR, e i WARNING che in pratica
# significano "il modulo non è stato caricato affatto" — Odoo può uscire 0 e
# stampare solo un WARNING quando non trova il modulo o un suo file, quindi
# non basta filtrare su "ERROR"/"CRITICAL".
ERROR_PATTERN='Traceback|CRITICAL|ERROR |invalid module names, ignored|[Nn]o such file or directory'
if [ "$EXIT_CODE" -ne 0 ] || grep -qE "$ERROR_PATTERN" "$LOGFILE"; then
  echo ""
  echo "❌ VERIFICA FALLITA — il modulo NON viene promosso."
  echo ""
  echo "--- Estratto errore (vedi $LOGFILE per il log completo) ---"
  grep -A 5 -E "$ERROR_PATTERN" "$LOGFILE" | head -60
  rollback
  exit 1
fi

echo "✅ Installazione su staging riuscita, nessun errore rilevato."
echo "custom-addons già aggiornato (Step 1)."

# L'aggiornamento sopra (-i/-u --stop-after-init) gira in un processo Odoo
# separato (docker compose exec), non nel server web persistente. Su questo
# VPS Odoo gira senza "workers" (single-process): il server già in esecuzione
# NON ricarica da solo registro/menu/viste dopo una modifica esterna al DB,
# serve un restart esplicito — altrimenti l'utente vede ancora comportamento
# vecchio (menu mancanti, "field is undefined") pur con lo schema già corretto.
# Scoperto il 17/08/2026 dopo due falsi allarmi live per questo motivo esatto.
echo ""
echo "=== Step 2bis — Riavvio servizio Odoo (registro live non si auto-ricarica) ==="
docker compose restart "$ODOO_SERVICE_NAME"
sleep 8
echo "✅ Servizio riavviato."

echo ""
echo "=== Step 3 — Aggiornamento su produzione ==="
echo "NOTA: questo passo aggiorna anche il database di produzione ($PROD_DB)."
read -p "Procedere con l'aggiornamento in produzione ora? (s/N) " CONFIRM
if [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "S" ]; then
  check_db_safety "$PROD_DB"
  classify_modules "$PROD_DB" $MODULES
  build_odoo_args "$PROD_DB"
  docker compose exec -T "$ODOO_SERVICE_NAME" \
    odoo "${ODOO_ARGS[@]}" < /dev/null
  echo "✅ Produzione aggiornata."
  echo "Ricorda di riavviare il servizio se necessario: docker compose restart $ODOO_SERVICE_NAME"
else
  echo "Promozione a custom-addons completata, produzione NON aggiornata ora."
  echo "Per farlo più tardi: rilancia $0 con gli stessi moduli, oppure esegui manualmente docker compose exec $ODOO_SERVICE_NAME odoo -c $ODOO_CONF_PATH -d $PROD_DB -i/-u <moduli> --stop-after-init a seconda dello stato attuale."
fi
