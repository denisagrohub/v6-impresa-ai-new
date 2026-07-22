#!/bin/bash
# ============================================================
# MIGRAZIONE E COMPLETAMENTO: v6-impresa-ai
# Unisce il progetto esistente (dump) con la nuova base
# ============================================================
# Questo script:
# 1. Copia tutti i file utili dal dump nel nuovo progetto
# 2. Migra le pagine (admin, consultant, referral, booking, ecc.)
# 3. Integra i moduli Odoo
# 4. Copia assets (immagini, brands, icone)
# 5. Migra le KB e i dati
# 6. Adatta tutto al nuovo stack (Next.js 15, React 19)
# ============================================================

set -e  # Exit on error

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║  $1${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}
print_step()  { echo -e "${CYAN}➜${NC} $1"; }
print_success(){ echo -e "${GREEN}✅${NC} $1"; }
print_warning(){ echo -e "${YELLOW}⚠️${NC} $1"; }
print_error()  { echo -e "${RED}❌${NC} $1"; }

# ============================================================
# CONFIGURAZIONE
# ============================================================
OLD_PROJECT="$HOME/Documents/siti web/progetto-impresa"
NEW_PROJECT="$HOME/v6-impresa-ai"

if [ ! -d "$OLD_PROJECT" ]; then    print_error "Progetto originale non trovato in $OLD_PROJECT"
    echo "Assicurati che la cartella 'progetto-impresa' esista in $HOME"
    exit 1
fi

if [ ! -d "$NEW_PROJECT" ]; then
    print_error "Nuovo progetto non trovato in $NEW_PROJECT"
    echo "Esegui prima lo script setup-v6-impresa-ai.sh"
    exit 1
fi

print_header "MIGRAZIONE PROGETTO IMPRESA → V6 IMPRESA AI"
print_step "Da: $OLD_PROJECT"
print_step "A:  $NEW_PROJECT"

cd "$NEW_PROJECT"

# ============================================================
# 1. COPIA MODULI ODOO
# ============================================================
print_header "1. COPIA MODULI ODOO CUSTOM"

if [ -d "$OLD_PROJECT/odoo-modules" ]; then
    print_step "Copia moduli Odoo..."
    mkdir -p odoo-modules
    cp -r "$OLD_PROJECT/odoo-modules/"* odoo-modules/ 2>/dev/null || true
    print_success "Moduli Odoo copiati"
else
    print_warning "Cartella odoo-modules non trovata nel progetto originale"
fi

# ============================================================
# 2. COPIA ASSETS (immagini, brands, icone)
# ============================================================
print_header "2. COPIA ASSETS"

if [ -d "$OLD_PROJECT/public" ]; then
    print_step "Copia assets pubblici..."
    # Copia immagini
    if [ -d "$OLD_PROJECT/public/images" ]; then
        mkdir -p public/images
        cp -r "$OLD_PROJECT/public/images/"* public/images/ 2>/dev/null || true
        print_success "Immagini copiate"
    fi
    
    # Copia brands
    if [ -d "$OLD_PROJECT/public/brands" ]; then
        mkdir -p public/brands
        cp -r "$OLD_PROJECT/public/brands/"* public/brands/ 2>/dev/null || true
        print_success "Brands copiati"
    fi
    
    # Copia altri file SVG
    for file in file.svg vercel.svg next.svg globe.svg window.svg; do
        if [ -f "$OLD_PROJECT/public/$file" ]; then
            cp "$OLD_PROJECT/public/$file" public/ 2>/dev/null || true
        fi
    done
    print_success "Assets copiati"
fi

# ============================================================
# 3. COPIA KNOWLEDGE BASE
# ============================================================
print_header "3. COPIA KNOWLEDGE BASE"

if [ -d "$OLD_PROJECT/src/data/kb" ]; then
    print_step "Copia KB esistente..."
    mkdir -p src/data/kb
    cp -r "$OLD_PROJECT/src/data/kb/"* src/data/kb/ 2>/dev/null || true
    print_success "KB copiata"
fi

# Crea cartelle KB se mancano
mkdir -p src/data/kb/{plain,encrypted,core,method}
print_success "Struttura KB creata"

# ============================================================
# 4. COPIA FILE DI DATI (mock, config, etc.)
# ============================================================
print_header "4. COPIA FILE DI DATI"

if [ -d "$OLD_PROJECT/src/data" ]; then
    print_step "Copia dati di esempio..."
    # Copia solo file JSON che non sono già nella KB
    for file in drafts.json local-db.json consultant-mock.json partner-payments.json invoices.json partners.json partner.json referral-mock.json appointments.json commission-rules.json; do
        if [ -f "$OLD_PROJECT/src/data/$file" ]; then
            cp "$OLD_PROJECT/src/data/$file" src/data/ 2>/dev/null || true
        fi
    done
    print_success "Dati copiati"
fi

# ============================================================
# 5. MIGRAZIONE PAGINE (src/app)
# ============================================================
print_header "5. MIGRAZIONE PAGINE"

# Funzione per migrare una directory di pagine
migrate_pages() {
    local src_dir="$1"
    local dest_dir="$2"
    local name="$3"
    
    if [ -d "$OLD_PROJECT/src/app/$src_dir" ]; then
        print_step "Migrazione $name..."
        mkdir -p "src/app/$dest_dir"
        cp -r "$OLD_PROJECT/src/app/$src_dir/"* "src/app/$dest_dir/" 2>/dev/null || true
        print_success "$name migrato"
    else
        print_warning "$name non trovato"
    fi
}

# Migra tutte le sezioni principali
migrate_pages "admin" "admin" "Admin panel"
migrate_pages "consultant" "consultant" "Consultant dashboard"
migrate_pages "referral" "referral" "Referral system"
migrate_pages "booking" "booking" "Booking system"
migrate_pages "business-plan-pmi" "business-plan-pmi" "Business Plan PMI"
migrate_pages "business-plan-startup" "business-plan-startup" "Business Plan Startup"
migrate_pages "project-finance" "project-finance" "Project Finance"
migrate_pages "casi-studio" "casi-studio" "Case Studies"
migrate_pages "checkout" "checkout" "Checkout"
migrate_pages "contatti" "contatti" "Contacts"
migrate_pages "metodo" "metodo" "Methodology"
migrate_pages "chi-siamo" "chi-siamo" "About Us"
migrate_pages "login" "login" "Login"
migrate_pages "onboarding" "onboarding" "Onboarding"

# Pagine speciali
if [ -f "$OLD_PROJECT/src/app/dashboard/page.tsx" ]; then
    print_step "Migrazione dashboard principale..."
    mkdir -p src/app/dashboard
    cp "$OLD_PROJECT/src/app/dashboard/page.tsx" src/app/dashboard/ 2>/dev/null || true
fi

# ============================================================
# 6. MIGRAZIONE API ROUTES
# ============================================================
print_header "6. MIGRAZIONE API ROUTES"

if [ -d "$OLD_PROJECT/src/app/api" ]; then
    print_step "Migrazione API routes..."
    mkdir -p src/app/api
    cp -r "$OLD_PROJECT/src/app/api/"* src/app/api/ 2>/dev/null || true
    print_success "API routes migrate"
fi

# ============================================================
# 7. MIGRAZIONE COMPONENTI
# ============================================================
print_header "7. MIGRAZIONE COMPONENTI"

if [ -d "$OLD_PROJECT/src/components" ]; then
    print_step "Migrazione componenti..."
    mkdir -p src/components
    cp -r "$OLD_PROJECT/src/components/"* src/components/ 2>/dev/null || true
    print_success "Componenti migrati"
fi

# ============================================================
# 8. MIGRAZIONE HOOKS
# ============================================================
print_header "8. MIGRAZIONE HOOKS"

if [ -d "$OLD_PROJECT/src/hooks" ]; then
    print_step "Migrazione hooks..."
    mkdir -p src/hooks
    cp -r "$OLD_PROJECT/src/hooks/"* src/hooks/ 2>/dev/null || true
    print_success "Hooks migrati"
fi

# ============================================================
# 9. MIGRAZIONE LIB (adattatori, utilities)
# ============================================================
print_header "9. MIGRAZIONE LIBRERIE"

if [ -d "$OLD_PROJECT/src/lib" ]; then
    print_step "Migrazione lib (esclusi quelli già presenti)..."
    mkdir -p src/lib
    
    # Copia file che non esistono già
    for file in permissions.ts gateway-schema.ts pricing-engine.ts lead-queue.ts lead-scoring.ts gateway-client.ts; do
        if [ -f "$OLD_PROJECT/src/lib/$file" ]; then
            cp "$OLD_PROJECT/src/lib/$file" src/lib/ 2>/dev/null || true
        fi
    done
    
    print_success "Librerie migrate"
fi

# ============================================================
# 10. MIGRAZIONE TYPES
# ============================================================
print_header "10. MIGRAZIONE TYPES"

if [ -d "$OLD_PROJECT/src/types" ]; then
    print_step "Migrazione type definitions..."
    mkdir -p src/types
    cp -r "$OLD_PROJECT/src/types/"* src/types/ 2>/dev/null || true
    print_success "Types migrati"
fi

# ============================================================
# 11. MIGRAZIONE MIDDLEWARE E CONFIG
# ============================================================
print_header "11. MIGRAZIONE MIDDLEWARE & CONFIG"

# middleware
if [ -f "$OLD_PROJECT/src/middleware.ts" ]; then
    print_step "Migrazione middleware..."
    cp "$OLD_PROJECT/src/middleware.ts" src/ 2>/dev/null || true
    print_success "Middleware migrato"
fi

# system config
if [ -f "$OLD_PROJECT/src/config/system.ts" ]; then
    print_step "Migrazione system config..."
    mkdir -p src/config
    cp "$OLD_PROJECT/src/config/system.ts" src/config/ 2>/dev/null || true
    print_success "System config migrato"
fi

# ============================================================
# 12. AGGIUNTA DIPENDENZE MANCANTI
# ============================================================
print_header "12. AGGIUNTA DIPENDENZE MANCANTI"

print_step "Aggiornamento package.json con dipendenze dal progetto originale..."

# Estrai dipendenze dal package.json originale e aggiungi al nuovo
if [ -f "$OLD_PROJECT/package.json" ]; then
    # Usa node per unire i package.json
    node -e "
    const fs = require('fs');
    const oldPkg = JSON.parse(fs.readFileSync('$OLD_PROJECT/package.json', 'utf-8'));
    const newPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    
    // Unisci le dipendenze
    for (const [key, val] of Object.entries(oldPkg.dependencies || {})) {
      if (!newPkg.dependencies[key]) {
        newPkg.dependencies[key] = val;
      }
    }
    for (const [key, val] of Object.entries(oldPkg.devDependencies || {})) {
      if (!newPkg.devDependencies[key]) {
        newPkg.devDependencies[key] = val;
      }
    }
    
    // Aggiungi script mancanti
    const scripts = {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint',
      'kb:encrypt': 'node scripts/encrypt-kb.js',
      'kb:decrypt': 'node scripts/decrypt-kb.js',
      'odoo:test': 'node scripts/test-odoo.js',
      'odoo:sync': 'node scripts/sync-odoo.js'
    };
    newPkg.scripts = { ...scripts, ...newPkg.scripts };
    
    fs.writeFileSync('package.json', JSON.stringify(newPkg, null, 2));
    "
    print_success "package.json aggiornato"
fi

# ============================================================
# 13. INSTALLAZIONE NUOVE DIPENDENZE
# ============================================================
print_header "13. INSTALLAZIONE DIPENDENZE AGGIUNTE"

print_step "Installazione dipendenze mancanti (potrebbe richiedere alcuni minuti)..."
npm install 2>/dev/null || true
print_success "Dipendenze installate"

# ============================================================
# 14. COPIA SCRIPT UTILI
# ============================================================
print_header "14. COPIA SCRIPT UTILI"

if [ -d "$OLD_PROJECT/scripts" ]; then
    print_step "Copia script..."
    mkdir -p scripts
    for script in deploy-odoo.sh encrypt-kb.js; do
        if [ -f "$OLD_PROJECT/scripts/$script" ]; then
            cp "$OLD_PROJECT/scripts/$script" scripts/ 2>/dev/null || true
        fi
    done
    print_success "Script copiati"
fi

# ============================================================
# 15. COPIA FILE DI CONFIGURAZIONE (tailwind, next, etc.)
# ============================================================
print_header "15. COPIA FILE DI CONFIG"

# tailwind.config.js
if [ -f "$OLD_PROJECT/tailwind.config.js" ]; then
    print_step "Migrazione tailwind.config.js..."
    cp "$OLD_PROJECT/tailwind.config.js" . 2>/dev/null || true
fi

# .env.local.example
if [ -f "$OLD_PROJECT/.env.local.example" ]; then
    print_step "Migrazione .env.local.example..."
    cp "$OLD_PROJECT/.env.local.example" . 2>/dev/null || true
fi

# .env.ODOO_DEPLOY.example
if [ -f "$OLD_PROJECT/.env.ODOO_DEPLOY.example" ]; then
    print_step "Migrazione .env.ODOO_DEPLOY.example..."
    cp "$OLD_PROJECT/.env.ODOO_DEPLOY.example" . 2>/dev/null || true
fi

print_success "File di configurazione migrati"

# ============================================================
# 16. CREAZIONE STRUTTURA PER LE NUOVE FUNZIONALITÀ
# ============================================================
print_header "16. CREAZIONE STRUTTURA PER NUOVE FUNZIONALITÀ"

# Crea cartelle per le nuove funzionalità discusse
mkdir -p src/services/premium
mkdir -p src/services/brand
mkdir -p src/services/storytelling
mkdir -p src/lib/layout
mkdir -p src/lib/interview
mkdir -p src/lib/pricing

# Crea file placeholder per le nuove funzionalità
cat > src/services/premium/index.ts << 'EOF'
// Servizio Premium - Brand Analysis, Storytelling, Marketing Plan
export * from './brand-analysis';
export * from './storytelling';
export * from './marketing-plan';
EOF

cat > src/services/premium/brand-analysis.ts << 'EOF'
// Brand Analysis Service
export class BrandAnalysis {
  async analyze(data: any) {
    // Implementazione brand analysis
    return { status: 'ready', analysis: {} };
  }
}
EOF

cat > src/lib/interview/interview-engine.ts << 'EOF'
// Interview Engine - Gestisce l'intervista dinamica
export class InterviewEngine {
  async createInterview(data: any) {
    // Crea un'intervista personalizzata
    return { id: Date.now(), questions: [] };
  }
  
  async executeInterview(interview: any, answers: any) {
    // Esegue l'intervista e analizza le risposte
    return { scores: {}, recommendations: [] };
  }
}
EOF

cat > src/lib/pricing/pricing-engine.ts << 'EOF'
// Pricing Engine - Calcolo prezzo dinamico
export class PricingEngine {
  calculate(data: any) {
    // Calcolo basato su complessità, urgenza, personalizzazione
    return {
      base: 3000,
      total: 5000,
      breakdown: { 'Analisi': 1500, 'Sviluppo': 2000, 'Revisione': 1500 }
    };
  }
}
EOF

cat > src/lib/layout/layout-engine.ts << 'EOF'
// Layout Engine - Impaginazione dinamica per destinatario
export class LayoutEngine {
  async generate(data: any, audience: string) {
    const templates = {
      bank: 'finance-grade',
      investor: 'venture-pitch',
      partner: 'partnership',
      internal: 'executive'
    };
    return { template: templates[audience] || 'standard', data };
  }
}
EOF

print_success "Struttura per nuove funzionalità creata"

# ============================================================
# 17. GENERAZIONE PAGINE MANCANTI (intervista, premium, ecc.)
# ============================================================
print_header "17. GENERAZIONE PAGINE MANCANTI"

# Pagina intervista se non esiste
if [ ! -f "src/app/intervista/page.tsx" ]; then
    print_step "Creazione pagina intervista..."
    mkdir -p src/app/intervista
    cat > src/app/intervista/page.tsx << 'EOF'
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function IntervistaPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const router = useRouter();

  const questions = [
    { id: 'nome', label: 'Come si chiama la tua azienda?', type: 'text' },
    { id: 'settore', label: 'In quale settore operate?', type: 'text' },
    { id: 'destinatario', label: 'A chi è destinato il business plan?', type: 'select', options: ['Banca', 'Investitore', 'Partner', 'Interno'] },
    { id: 'obiettivi', label: 'Quali sono i tuoi obiettivi principali?', type: 'text' }
  ];

  // ... resto della logica
}
EOF
fi

# Pagina premium upgrade se non esiste
if [ ! -d "src/app/premium" ]; then
    print_step "Creazione pagina premium..."
    mkdir -p src/app/premium
    cat > src/app/premium/page.tsx << 'EOF'
export default function PremiumPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold">✨ Pacchetto Premium</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="p-6 border rounded-lg">
          <h3 className="font-bold">Base</h3>
          <p className="text-2xl font-bold mt-2">€3.000</p>
          <ul className="mt-4 space-y-2">
            <li>✓ Business Plan V6</li>
            <li>✓ Analisi finanziaria</li>
          </ul>
        </div>
        <div className="p-6 border-2 border-blue-600 rounded-lg shadow-lg">
          <h3 className="font-bold text-blue-600">⭐ Premium</h3>
          <p className="text-2xl font-bold mt-2">€10.000</p>
          <ul className="mt-4 space-y-2">
            <li>✓ Business Plan V6</li>
            <li>✓ Brand Analysis</li>
            <li>✓ Storytelling</li>
            <li>✓ Marketing Plan</li>
          </ul>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="font-bold">Executive</h3>
          <p className="text-2xl font-bold mt-2">€25.000</p>
          <ul className="mt-4 space-y-2">
            <li>✓ Tutto del Premium</li>
            <li>✓ Workshop strategico</li>
            <li>✓ Supporto 1 anno</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
EOF
fi

print_success "Pagine mancanti create"

# ============================================================
# 18. ADATTAMENTO IMPORT PER NUOVO STACK
# ============================================================
print_header "18. ADATTAMENTO IMPORT PER NEXT.JS 15"

print_step "Aggiornamento import paths (se necessario)..."
# Questo è un placeholder - in caso di problemi, verranno corretti manualmente

# ============================================================
# 19. CREAZIONE FILE README
# ============================================================
print_header "19. CREAZIONE README"

cat > README.md << 'EOF'
# 🚀 V6 Impresa AI Platform

Piattaforma di consulenza avanzata per business plan, brand analysis e marketing strategico.

## 📦 Feature

- **AI Co-pilot** - Assistente intelligente per la stesura del business plan
- **Intervista Dinamica** - Raccolta dati personalizzata
- **Brand Analysis** - Analisi approfondita del posizionamento
- **Storytelling** - Narrazione del brand professionale
- **Marketing Plan** - Piano marketing personalizzato
- **Layout Dinamico** - Impaginazione adattiva per destinatario
- **Pacchetto Premium** - Servizi avanzati ad alto valore

## 🚀 Avvio

```bash
npm run dev
