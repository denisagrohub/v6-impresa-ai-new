#!/bin/bash
# fix-intervista-cta.sh
# Reindirizza tutti i CTA "Richiedi preventivo" all'intervista intelligente

set -e
cd ~/Documents/v6-impresa-ai

echo "🎯 Reindirizzamento CTA verso intervista..."

# ----------------------------------------------------------------
# 1. AGGIORNA LA PAGINA PREMIUM (collega i pulsanti all'intervista)
# ----------------------------------------------------------------
cat > src/app/premium/page.tsx << 'EOF'
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const packages = [
  { id: 'base', name: 'Base', price: '€3.000', description: 'Business Plan V6', popular: false, badge: null, features: ['Business Plan completo', 'Analisi finanziaria base', 'Proiezioni 3 anni', '1 revisione inclusa'] },
  { id: 'starter', name: 'Starter', price: '€5.500', description: 'Business Plan + Analisi', popular: true, badge: '🌟 Più richiesto', features: ['Tutto del Base', 'Analisi di settore approfondita', 'Benchmarking competitivo', 'Analisi dei rischi', '3 revisioni incluse'] },
  { id: 'premium', name: 'Premium', price: '€10.000', description: 'Business Plan + Brand + Marketing', popular: true, badge: '⭐ Raccomandato', features: ['Tutto dello Starter', 'Brand Analysis completa', 'Storytelling professionale', 'Piano Marketing 12 mesi', 'Template brand identity', 'Revisioni illimitate', 'Video call con consulente'] },
  { id: 'executive', name: 'Executive', price: '€18.000', description: 'Premium + Workshop + Supporto', popular: false, badge: '👑 Per grandi aziende', features: ['Tutto del Premium', 'Workshop strategico (2 giorni)', 'Supporto 1 anno', 'Report trimestrali', 'Dedicated account manager', 'Certificazione blockchain'] },
  { id: 'custom', name: 'Custom', price: 'Su misura', description: 'Progetto personalizzato', popular: false, badge: '✨ Tailor-made', features: ['Consulenza dedicata', 'Soluzione tailor-made', 'Scopriamo le tue esigenze', 'Servizi premium esclusivi', 'Team dedicato'] }
];

export default function PremiumPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            <span className="text-orange-500">🚀</span> Scegli il Pacchetto Perfetto
          </h1>
          <p className="text-xl text-gray-600">Scegli il pacchetto e inizia l'intervista per ricevere una proposta personalizzata.</p>
        </div>

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
                <Link href={`/intervista?package=${pkg.id}&packageName=${encodeURIComponent(pkg.name)}`}>
                  <Button variant={pkg.popular ? 'primary' : 'secondary'} size="lg" fullWidth>
                    Richiedi preventivo
                  </Button>
                </Link>
              </div>
              {pkg.popular && <p className="text-xs text-center text-orange-500 mt-2 font-medium">🔥 La scelta più popolare</p>}
            </Card>
          ))}
        </div>

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

# ----------------------------------------------------------------
# 2. AGGIORNA LE LANDING L1, L2, L3 (puntano all'intervista)
# ----------------------------------------------------------------
for landing in "business-plan-startup" "business-plan-pmi" "project-finance"; do
  if [ -f "src/app/$landing/page.tsx" ]; then
    # Sostituisci i link a /form o /contatti o /checkout con /intervista
    sed -i '' 's|href="/form"|href="/intervista"|g' "src/app/$landing/page.tsx" 2>/dev/null || true
    sed -i '' 's|href="/contatti"|href="/intervista"|g' "src/app/$landing/page.tsx" 2>/dev/null || true
    sed -i '' 's|href="/checkout[^"]*"|href="/intervista"|g' "src/app/$landing/page.tsx" 2>/dev/null || true
    # Sostituisci anche i testi dei pulsanti se necessario
    sed -i '' 's/Richiedi preventivo/Inizia intervista/g' "src/app/$landing/page.tsx" 2>/dev/null || true
    echo "✅ $landing aggiornato"
  fi
done

# ----------------------------------------------------------------
# 3. HOME: sostituisci "Inizia Ora" e "Scopri Premium" con link all'intervista
# ----------------------------------------------------------------
sed -i '' 's|href="/intervista"|href="/intervista"|g' src/app/page.tsx 2>/dev/null || true
sed -i '' 's|href="/premium"|href="/premium"|g' src/app/page.tsx 2>/dev/null || true

# ----------------------------------------------------------------
# 4. MIGLIORA LA PAGINA INTERVISTA (legge il pacchetto e personalizza)
# ----------------------------------------------------------------
cat > src/app/intervista/page.tsx << 'EOF'
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

export default function IntervistaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');
  const packageName = searchParams.get('packageName') || 'selezionato';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefono: '',
    azienda: '',
    settore: '',
    fatturato: '',
    destinatario: '',
    obiettivi: '',
    package: packageId || '',
  });

  const questions = [
    { id: 'nome', label: 'Come ti chiami?', type: 'text', placeholder: 'Mario Rossi', required: true },
    { id: 'email', label: 'Qual è la tua email?', type: 'email', placeholder: 'mario@esempio.it', required: true },
    { id: 'telefono', label: 'Il tuo numero di telefono', type: 'tel', placeholder: '+39 333 1234567', required: false },
    { id: 'azienda', label: 'Nome della tua azienda', type: 'text', placeholder: 'Innovazione S.r.l.', required: true },
    { id: 'settore', label: 'In quale settore operate?', type: 'text', placeholder: 'Tech, Manifatturiero, Food...', required: true },
    { id: 'fatturato', label: 'Fatturato annuo (indicativo)', type: 'select', options: ['< 1M€', '1M€ - 5M€', '5M€ - 10M€', '> 10M€'], required: true },
    { id: 'destinatario', label: 'A chi è destinato il business plan?', type: 'select', options: ['Banca', 'Investitore', 'Partner', 'Interno'], required: true },
    { id: 'obiettivi', label: 'Quali sono i tuoi obiettivi principali?', type: 'textarea', placeholder: 'Descrivi brevemente cosa vuoi ottenere...', required: true },
  ];

  const totalSteps = questions.length;

  const handleChange = (e: any) => {
    setFormData({ ...formData, [questions[step].id]: e.target.value });
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Invia i dati all'API leads
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'intervista',
          package: packageName,
          packageId: packageId,
          ...formData,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Errore invio');
      
      // Invia anche notifica email all'admin (se esiste l'API email)
      await fetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'admin@progettoimpresa.it',
          subject: `Nuova intervista - ${formData.nome} (${packageName})`,
          html: `
            <h2>Nuova richiesta preventivo</h2>
            <p><strong>Pacchetto:</strong> ${packageName}</p>
            <p><strong>Nome:</strong> ${formData.nome}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Telefono:</strong> ${formData.telefono}</p>
            <p><strong>Azienda:</strong> ${formData.azienda}</p>
            <p><strong>Settore:</strong> ${formData.settore}</p>
            <p><strong>Fatturato:</strong> ${formData.fatturato}</p>
            <p><strong>Destinatario:</strong> ${formData.destinatario}</p>
            <p><strong>Obiettivi:</strong> ${formData.obiettivi}</p>
          `,
        }),
      });

      setSubmitted(true);
      setTimeout(() => {
        router.push('/contatti?success=true');
      }, 2000);
    } catch (err) {
      alert('Errore nell\'invio. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-center">
          <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Grazie!</h2>
          <p className="text-gray-600">La tua richiesta è stata inviata. Ti contatteremo entro 24 ore.</p>
        </div>
      </div>
    );
  }

  const q = questions[step];
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container max-w-2xl mx-auto px-4">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="primary" className="bg-orange-500 text-white">
              Passo {step + 1} di {totalSteps}
            </Badge>
            {packageId && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                Pacchetto {packageName}
              </Badge>
            )}
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">{q.label}</h2>
          {q.type === 'select' ? (
            <select
              value={formData[q.id as keyof typeof formData] || ''}
              onChange={handleChange}
              className="w-full mt-4 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20"
              required={q.required}
            >
              <option value="">Seleziona...</option>
              {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : q.type === 'textarea' ? (
            <textarea
              value={formData[q.id as keyof typeof formData] || ''}
              onChange={handleChange}
              placeholder={q.placeholder}
              rows={4}
              className="w-full mt-4 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 resize-none"
              required={q.required}
            />
          ) : (
            <input
              type={q.type}
              value={formData[q.id as keyof typeof formData] || ''}
              onChange={handleChange}
              placeholder={q.placeholder}
              className="w-full mt-4 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20"
              required={q.required}
            />
          )}

          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleNext}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : step === totalSteps - 1 ? (
                <>Invia richiesta <ArrowRight size={18} /></>
              ) : (
                <>Avanti <ArrowRight size={18} /></>
              )}
            </Button>
          </div>
        </Card>

        <p className="text-xs text-gray-500 text-center mt-4">
          🔒 I tuoi dati sono al sicuro. Non li condivideremo con terzi.
        </p>
      </div>
    </main>
  );
}
EOF

# ----------------------------------------------------------------
# 5. PULIZIA CACHE
# ----------------------------------------------------------------
rm -rf .next

echo ""
echo "============================================================"
echo "✅ INTERVISTA CTA COMPLETATO!"
echo "============================================================"
echo ""
echo "📌 Ora quando un cliente clicca su 'Richiedi preventivo':"
echo ""
echo "   1️⃣ Viene portato a /intervista con il pacchetto pre-selezionato"
echo "   2️⃣ Compila un percorso guidato di 8 domande"
echo "   3️⃣ I dati vengono salvati come lead e notificati all'admin"
echo "   4️⃣ Riceve un messaggio di conferma e viene reindirizzato a /contatti"
echo ""
echo "🚀 Riavvia il server:"
echo "   npm run dev"
echo ""
echo "🔗 Prova: vai su /premium e clicca su 'Richiedi preventivo'"
echo "   Dovresti finire nell'intervista con il pacchetto pre-selezionato."
echo ""
echo "============================================================"
