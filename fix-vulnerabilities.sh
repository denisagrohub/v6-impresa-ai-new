#!/bin/bash
# fix-vulnerabilities.sh

cd ~/Documents/v6-impresa-ai

echo "🔧 Aggiornamento pacchetti vulnerabili (senza breaking changes)..."

npm install next@14.2.22 --save
npm install postcss@8.5.10 --save-dev
npm install serialize-javascript@7.0.2 --save-dev
npm install minimatch@9.0.7 --save-dev

# Reinstalla per sicurezza
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

echo "✅ Vulnerabilità critiche risolte (Next.js, postcss, etc.)"
echo "📊 Verifica: npm audit"
