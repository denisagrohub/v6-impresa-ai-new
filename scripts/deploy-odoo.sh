#!/bin/bash
# scripts/deploy-odoo.sh
# ============================================================================
# Deploy moduli Odoo custom dal repo Next.js al VPS Aruba
# ============================================================================

set -e

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Carica configurazione da secure-config.json
CONFIG_FILE="src/data/secure-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ File $CONFIG_FILE non trovato${NC}"
    echo "Configura prima le credenziali dalla pagina Admin → Impostazioni Sistema"
    exit 1
fi

# Estrai configurazione deploy da JSON
VPS_HOST=$(jq -r '.deploy.vpsHost' "$CONFIG_FILE")
VPS_USER=$(jq -r '.deploy.vpsUser' "$CONFIG_FILE")
VPS_SSH_PORT=$(jq -r '.deploy.vpsSshPort' "$CONFIG_FILE")
VPS_SSH_KEY=$(jq -r '.deploy.vpsSshKeyPath' "$CONFIG_FILE")
ODOO_ADDONS_PATH=$(jq -r '.deploy.odooAddonsPath' "$CONFIG_FILE")
ODOO_SERVICE=$(jq -r '.deploy.odooService' "$CONFIG_FILE")
ODOO_USER=$(jq -r '.deploy.odooUser' "$CONFIG_FILE")

# Validazione
if [ -z "$VPS_HOST" ] || [ "$VPS_HOST" = "null" ]; then
    echo -e "${RED}❌ Configurazione VPS mancante${NC}"
    echo "Configura le credenziali dalla pagina Admin → Impostazioni Sistema"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Deploy Moduli Odoo - Progetto Impresa                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Costruisci comandi SSH/SCP
SSH_CMD="ssh"
SCP_CMD="scp"
if [ -n "$VPS_SSH_KEY" ] && [ "$VPS_SSH_KEY" != "null" ]; then
    SSH_CMD="$SSH_CMD -i $VPS_SSH_KEY"
    SCP_CMD="$SCP_CMD -i $VPS_SSH_KEY"
fi
if [ "$VPS_SSH_PORT" != "22" ] && [ "$VPS_SSH_PORT" != "null" ]; then
    SSH_CMD="$SSH_CMD -p $VPS_SSH_PORT"
    SCP_CMD="$SCP_CMD -P $VPS_SSH_PORT"
fi
SSH_CMD="$SSH_CMD -o StrictHostKeyChecking=no"

# Se ci sono parametri, deploy solo quelli
if [ $# -gt 0 ]; then
    MODULES_TO_DEPLOY="$@"
    echo -e "${YELLOW}📦 Deploy selettivo: $MODULES_TO_DEPLOY${NC}"
else
    MODULES_TO_DEPLOY=$(ls -d odoo-modules/*/ 2>/dev/null | xargs -n 1 basename 2>/dev/null || echo "")
    if [ -z "$MODULES_TO_DEPLOY" ]; then
        echo -e "${RED}❌ Nessun modulo trovato in odoo-modules/${NC}"
        exit 1
    fi
    echo -e "${YELLOW}📦 Deploy completo: $MODULES_TO_DEPLOY${NC}"
fi
echo ""

# Test connessione SSH
echo -e "${BLUE}🔌 Test connessione SSH a $VPS_USER@$VPS_HOST...${NC}"
if ! $SSH_CMD $VPS_USER@$VPS_HOST "echo 'OK'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Connessione SSH fallita!${NC}"
    echo "Verifica:"
    echo "  - IP/hostname del VPS"
    echo "  - Credenziali SSH"
    echo "  - Firewall del VPS"
    exit 1
fi
echo -e "${GREEN}  ✓ Connessione OK${NC}"
echo ""

# Crea cartella se non esiste
echo -e "${BLUE}📁 Verifica cartella destinazione...${NC}"
$SSH_CMD $VPS_USER@$VPS_HOST "sudo mkdir -p $ODOO_ADDONS_PATH && sudo chown -R $ODOO_USER:$ODOO_USER $ODOO_ADDONS_PATH"
echo -e "${GREEN}  ✓ Cartella pronta: $ODOO_ADDONS_PATH${NC}"
echo ""

# Deploy moduli
echo -e "${BLUE}📤 Deploy moduli...${NC}"
for module_name in $MODULES_TO_DEPLOY; do
    module_dir="odoo-modules/$module_name"
    
    if [ ! -d "$module_dir" ]; then
        echo -e "${RED}  ❌ $module_name non trovato${NC}"
        continue
    fi
    
    if [ ! -f "$module_dir/__manifest__.py" ]; then
        echo -e "${RED}  ❌ $module_name: __manifest__.py mancante${NC}"
        continue
    fi
    
    echo -e "  📦 Deploy ${YELLOW}$module_name${NC}..."
    
    # Rimuovi vecchia versione
    $SSH_CMD $VPS_USER@$VPS_HOST "sudo rm -rf $ODOO_ADDONS_PATH/$module_name" 2>/dev/null || true
    
    # Copia nuova versione
    $SCP_CMD -r "$module_dir" $VPS_USER@$VPS_HOST:/tmp/
    $SSH_CMD $VPS_USER@$VPS_HOST "sudo mv /tmp/$module_name $ODOO_ADDONS_PATH/ && sudo chown -R $ODOO_USER:$ODOO_USER $ODOO_ADDONS_PATH/$module_name"
    
    echo -e "${GREEN}  ✓ $module_name deployato${NC}"
done
echo ""

# Permessi finali
echo -e "${BLUE}🔐 Impostazione permessi...${NC}"
$SSH_CMD $VPS_USER@$VPS_HOST "sudo chmod -R 755 $ODOO_ADDONS_PATH"
echo -e "${GREEN}  ✓ Permessi impostati${NC}"
echo ""

# Restart servizio Odoo
echo -e "${BLUE}🔄 Restart servizio Odoo...${NC}"
$SSH_CMD $VPS_USER@$VPS_HOST "sudo systemctl restart $ODOO_SERVICE"
sleep 3
echo -e "${GREEN}  ✓ Servizio riavviato${NC}"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Deploy completato con successo!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📋 Prossimi passi:${NC}"
echo "  1. Accedi a Odoo come admin: https://$VPS_HOST/web/login"
echo "  2. Vai in Apps → icona ⚙️ in alto → 'Update Apps List'"
echo "  3. Cerca il modulo e clicca Install/Upgrade"
echo ""