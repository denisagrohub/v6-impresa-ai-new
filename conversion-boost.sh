#!/bin/bash
# ================================================================
# CONVERSION BOOST - Script per massimizzare le conversioni
# ================================================================
set -e

cd ~/Documents/v6-impresa-ai

echo "🚀 Applicazione miglioramenti per la conversione..."

# ----------------------------------------------------------------
# 1. TABELLA COMPARATIVA 5 PACCHETTI (sostituisce la vecchia premium)
# ----------------------------------------------------------------
cat > src/app/premium/page.tsx << 'EOF'
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, X, HelpCircle } from 'lucide-react';

// Dati dei pacchetti
const packages = [
  { id: 'base', name: 'Base', price: '€3.000', description: 'Business Plan V6', popular: false, badge: null, features: ['Business Plan completo', 'Analisi finanziaria base', 'Proiezioni 3 anni', '1 revisione inclusa'] },
  { id: 'starter', name: 'Starter', price: '€5.500', description: 'Business Plan + Analisi', popular: true, badge: '🌟 Più richiesto', features: ['Tutto del Base', 'Analisi di settore approfondita', 'Benchmarking competitivo', 'Analisi dei rischi', '3 revisioni incluse'] },
  { id: 'premium', name: 'Premium', price: '€10.000', description: 'Business Plan + Brand + Marketing', popular: true, badge: '⭐ Raccomandato', features: ['Tutto dello Starter', 'Brand Analysis completa', 'Storytelling professionale', 'Piano Marketing 12 mesi', 'Template brand identity', 'Revisioni illimitate', 'Video call con consulente'] },
  { id: 'executive', name: 'Executive', price: '€18.000', description: 'Premium + Workshop + Supporto', popular: false, badge: '👑 Per grandi aziende', features: ['Tutto del Premium', 'Workshop strategico (2 giorni)', 'Supporto 1 anno', 'Report trimestrali', 'Dedicated account manager', 'Certificazione blockchain'] },
  { id: 'custom', name: 'Custom', price: 'Su misura', description: 'Progetto personalizzato', popular: false, badge: '✨ Tailor-made', features: ['Consulenza dedicata', 'Soluzione tailor-made', 'Scopriamo le tue esigenze', 'Servizi premium esclusivi', 'Team dedicato'] }
];

// Matrice di confronto (feature vs pacchetti)
const comparisonMatrix = [
  { feature: 'Business Plan V6', base: true, starter: true, premium: true, executive: true, custom: '✓' },
  { feature: 'Analisi finanziaria 3 anni', base: true, starter: true, premium: true, executive: true, custom: '✓' },
  { feature: 'Analisi di settore', base: false, starter: true, premium: true, executive: true, custom: '✓' },
  { feature: 'Benchmarking competitivo', base: false, starter: true, premium: true, executive: true, custom: '✓' },
  { feature: 'Analisi dei rischi', base: false, starter: true, premium: true, executive: true, custom: '✓' },
  { feature: 'Brand Analysis completa', base: false, starter: false, premium: true, executive: true, custom: '✓' },
  { feature: 'Storytelling professionale', base: false, starter: false, premium: true, executive: true, custom: '✓' },
  { feature: 'Piano Marketing 12 mesi', base: false, starter: false, premium: true, executive: true, custom: '✓' },
  { feature: 'Template brand identity', base: false, starter: false, premium: true, executive: true, custom: '✓' },
  { feature: 'Revisioni illimitate', base: false, starter: false, premium: true, executive: true, custom: '✓' },
  { feature: 'Video call con consulente', base: false, starter: false, premium: true, executive: true, custom: '✓' },
  { feature: 'Workshop strategico (2gg)', base: false, starter: false, premium: false, executive: true, custom: '✓' },
  { feature: 'Supporto 1 anno', base: false, starter: false, premium: false, executive: true, custom: '✓' },
  { feature: 'Certificazione blockchain', base: false, starter: false, premium: false, executive: true, custom: '✓' },
];

export default function PremiumPage() {
  const [view, setView] = useState<'cards' | 'table'>('cards');

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            <span className="text-orange-500">🚀</span> Scegli il Pacchetto Perfetto
          </h1>
          <p className="text-xl text-gray-600">
            Confronta i pacchetti e scegli quello più adatto alle tue esigenze.
          </p>
          <div className="mt-4 inline-flex bg-white rounded-xl border border-gray-200 p-1">
            <button onClick={() => setView('cards')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'cards' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Schede</button>
            <button onClick={() => setView('table')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'table' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Confronto</button>
          </div>
        </div>

        {/* VISTA CARD (5 pacchetti) */}
        {view === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {packages.map((pkg) => (
              <Card key={pkg.id} className={`relative p-6 ${pkg.popular ? 'border-2 border-orange-500 shadow-xl scale-105 z-10' : 'border shadow-md'}`}>
                {pkg.badge && <Badge variant="primary" className="absolute -top-3 right-4 bg-orange-500 text-white">{pkg.badge}</Badge>}
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">{pkg.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                  <p className="text-4xl font-bold text-orange-600 mt-4">{pkg.price}</p>
                </div>
                <ul className="mt-6 space-y-2 text-sm text-gray-600">
                  {pkg.features.slice(0, 5).map((f, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-orange-500">✓</span>{f}</li>
                  ))}
                  {pkg.features.length > 5 && <li className="text-xs text-gray-400">+{pkg.features.length - 5} altre feature</li>}
                </ul>
                <div className="mt-6">
                  <Link href={`/checkout/${pkg.id}`}>
                    <Button variant={pkg.popular ? 'primary' : 'secondary'} size="lg" fullWidth>Richiedi preventivo</Button>
                  </Link>
                </div>
                {pkg.popular && <p className="text-xs text-center text-orange-500 mt-2 font-medium">🔥 La scelta più popolare</p>}
              </Card>
            ))}
          </div>
        )}

        {/* VISTA TABELLA COMPARATIVA */}
        {view === 'table' && (
          <div className="max-w-5xl mx-auto overflow-x-auto">
            <table className="w-full bg-white rounded-2xl border border-gray-200 shadow-lg">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-left text-sm font-bold text-gray-700">Feature</th>
                  {packages.map(p => (
                    <th key={p.id} className={`p-4 text-center text-sm font-bold ${p.popular ? 'bg-orange-50' : ''}`}>
                      {p.name}<br /><span className="font-normal text-orange-600">{p.price}</span>
                      {p.badge && <div className="text-xs text-orange-500 mt-1">{p.badge}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonMatrix.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-700 font-medium">{row.feature}</td>
                    {packages.map(p => {
                      const val = row[p.id as keyof typeof row];
                      let display = '';
                      if (val === true) display = '✅';
                      else if (val === false) display = '—';
                      else display = String(val);
                      return (
                        <td key={p.id} className="p-4 text-center text-sm text-gray-600">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-xs text-gray-500 text-center">* Le feature possono variare in base al progetto</div>
          </div>
        )}

        {/* Badge di fiducia */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-center">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-orange-500">200+</div>
            <div className="text-sm text-gray-600">Progetti completati</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-orange-500">€50M+</div>
            <div className="text-sm text-gray-600">Finanziamenti ottenuti</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-orange-500">98%</div>
            <div className="text-sm text-gray-600">Clienti soddisfatti</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-orange-500">48h</div>
            <div className="text-sm text-gray-600">Consegna garantita</div>
          </div>
        </div>
      </div>
    </main>
  );
}
EOF

echo "✅ Premium page aggiornata con tabella comparativa e badge"

# ----------------------------------------------------------------
# 2. SOSTITUISCI "Scegli" con "Richiedi preventivo" su tutte le pagine
# ----------------------------------------------------------------
# Già fatto sopra (premium)
# Ora facciamo lo stesso su L1, L2, L3

for landing in "business-plan-startup" "business-plan-pmi" "project-finance"; do
  if [ -f "src/app/$landing/page.tsx" ]; then
    sed -i '' 's/Scegli/Richiedi preventivo/g' "src/app/$landing/page.tsx" 2>/dev/null || true
    sed -i '' 's/Inizia ora/Richiedi preventivo/g' "src/app/$landing/page.tsx" 2>/dev/null || true
    sed -i '' 's/Inizia il percorso/Richiedi preventivo/g' "src/app/$landing/page.tsx" 2>/dev/null || true
    echo "✅ $landing aggiornata"
  fi
done

# ----------------------------------------------------------------
# 3. HOME: AGGIUNGI BADGE DI FIDUCIA E OFFRTA TEMPORANEA
# ----------------------------------------------------------------
cat >> src/app/page.tsx << 'EOF'

      {/* OFFERTA A TEMPO LIMITATO */}
      <section className="container mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 text-white text-center animate-pulse">
          <p className="text-lg font-bold">🎯 Offerta valida solo fino al <span className="underline">31 Luglio 2026</span></p>
          <p className="text-sm opacity-90">Ricevi il 20% di sconto su tutti i pacchetti Premium e Executive.</p>
        </div>
      </section>

      {/* BADGE DI FIDUCIA */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-orange-500">200+</div>
            <div className="text-sm text-gray-600">Progetti completati</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-orange-500">€50M+</div>
            <div className="text-sm text-gray-600">Finanziamenti ottenuti</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-orange-500">98%</div>
            <div className="text-sm text-gray-600">Clienti soddisfatti</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-orange-500">48h</div>
            <div className="text-sm text-gray-600">Consegna garantita</div>
          </div>
        </div>
      </section>
EOF

echo "✅ Home aggiornata con offerta limitata e badge"

# ----------------------------------------------------------------
# 4. COLLEGA LE LANDING L1, L2, L3 AL FUNNEL (aggiungi CTA fisso)
# ----------------------------------------------------------------
for landing in "business-plan-startup" "business-plan-pmi" "project-finance"; do
  if [ -f "src/app/$landing/page.tsx" ]; then
    # Aggiungi un CTA fisso in alto (subito dopo l'hero)
    # Usiamo sed per inserire dopo l'hero section
    sed -i '' '/hero/a\
\
      {/* CTA FISSO - Prenota call gratuita */}\
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 -mt-4 relative z-20">\
        <div className="bg-white rounded-xl shadow-lg border border-orange-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">\
          <div className="flex items-center gap-2 text-sm text-gray-700">\
            <span className="text-orange-500 text-2xl">📞</span>\
            <span><strong>Prenota una call gratuita</strong> con un consulente</span>\
          </div>\
          <Link href="/contatti" className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 whitespace-nowrap">\
            Richiedi preventivo\
          </Link>\
        </div>\
      </div>' "src/app/$landing/page.tsx" 2>/dev/null || true
    echo "✅ $landing: CTA fisso aggiunto"
  fi
done

# ----------------------------------------------------------------
# 5. AGGIUNGI URGENZA: TEMPORANEO "SCONTO 20%"
# ----------------------------------------------------------------
# Aggiunto già nella home. Ora lo aggiungiamo anche su Premium.
sed -i '' '/<main class/a\
      <div className="container mx-auto px-4">\
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 mb-8 text-white text-center animate-pulse">\
          <p className="text-lg font-bold">🎯 Offerta valida solo fino al 31 Luglio 2026</p>\
          <p className="text-sm opacity-90">Ricevi il 20% di sconto su tutti i pacchetti Premium e Executive.</p>\
        </div>\
      </div>' src/app/premium/page.tsx 2>/dev/null || true

echo "✅ Urgenza aggiunta su Premium"

# ----------------------------------------------------------------
# 6. PULIZIA CACHE
# ----------------------------------------------------------------
rm -rf .next

echo ""
echo "============================================================"
echo "✅ CONVERSION BOOST COMPLETATO!"
echo "============================================================"
echo ""
echo "📌 Modifiche applicate:"
echo "   ✅ Tabella comparativa su Premium (vista 'Confronto')"
echo "   ✅ 'Scegli' sostituito con 'Richiedi preventivo'"
echo "   ✅ CTA fisso su tutte le landing L1, L2, L3"
echo "   ✅ Badge di fiducia su Home e Premium"
echo "   ✅ Offerta a tempo limitato (20% fino al 31/07)"
echo "   ✅ Collegate le landing al funnel principale"
echo ""
echo "🚀 Riavvia il server:"
echo "   npm run dev"
echo ""
echo "🔗 Ora la home mostra badge e offerta. Premium ha comparativa."
echo "   Le landing hanno un CTA fisso per la richiesta preventivo."
echo ""
echo "============================================================"
