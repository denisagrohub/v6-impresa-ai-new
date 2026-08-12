'use client';
import Link from 'next/link';
import { Button } from '@erpv6/ui';
import { Card } from '@erpv6/ui';
import { Badge } from '@erpv6/ui';

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
