'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-12 md:pt-32 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-fadeIn">
            <Badge variant="primary" className="text-sm px-4 py-1">
              🚀 Piattaforma di consulenza AI
            </Badge>
            <h1 className="heading-gradient text-5xl md:text-6xl lg:text-7xl leading-tight">
              Business Plan,
              <br />
              <span className="text-orange-500">Brand & Marketing</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-lg leading-relaxed">
              Trasforma la tua azienda con business plan, brand analysis 
              e marketing strategico potenziati dall'intelligenza artificiale.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/intervista">
                <Button size="lg" className="shadow-lg hover:shadow-xl">
                  🚀 Inizia Ora
                </Button>
              </Link>
              <Link href="/premium">
                <Button variant="secondary" size="lg">
                  💎 Scopri Premium
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-8 pt-4 text-sm text-gray-500">
              <span>✓ 500+ clienti soddisfatti</span>
              <span>✓ 4.9/5 su Trustpilot</span>
              <span>✓ 30 giorni di garanzia</span>
            </div>
          </div>
          
          <div className="relative animate-slideInRight delay-200">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-orange-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">AI in tempo reale</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                  <span className="text-2xl">📊</span>
                  <div>
                    <p className="font-semibold text-gray-800">Business Plan</p>
                    <p className="text-sm text-gray-500">Generato in 5 minuti</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="font-semibold text-gray-800">Brand Analysis</p>
                    <p className="text-sm text-gray-500">Posizionamento strategico</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                  <span className="text-2xl">📈</span>
                  <div>
                    <p className="font-semibold text-gray-800">Marketing Plan</p>
                    <p className="text-sm text-gray-500">Personalizzato per te</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 animate-fadeIn delay-100">
          <Badge variant="outline" className="mb-3">Perché sceglierci</Badge>
          <h2 className="section-title">La piattaforma completa per la tua crescita</h2>
          <p className="section-subtitle mx-auto">
            Tutto ciò di cui hai bisogno per portare la tua azienda al livello successivo.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="animate-fadeIn delay-200 hover:scale-[1.02]">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">AI Co-pilot</h3>
            <p className="text-gray-600">
              Assistente intelligente che ti guida nella stesura del business plan 
              e nell'analisi strategica.
            </p>
          </Card>
          
          <Card className="animate-fadeIn delay-300 hover:scale-[1.02]">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Brand Analysis</h3>
            <p className="text-gray-600">
              Analisi approfondita del posizionamento, della concorrenza e 
              della personalità del tuo brand.
            </p>
          </Card>
          
          <Card className="animate-fadeIn delay-400 hover:scale-[1.02]">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Marketing Plan</h3>
            <p className="text-gray-600">
              Piano marketing personalizzato con canali, budget e KPI 
              per i prossimi 12 mesi.
            </p>
          </Card>
        </div>
      </section>

      {/* ✅ NUOVA SEZIONE: SCOPRI I PACCHETTI */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center animate-fadeIn delay-300">
          <Badge variant="primary" className="mb-4">🆕 Nuovi Pacchetti</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Scegli il pacchetto giusto per te
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Dal Business Plan base al pacchetto Executive completo con supporto dedicato.
            Trova la soluzione che si adatta alle tue esigenze.
          </p>
          <Link href="/premium">
            <Button size="lg" className="shadow-lg hover:shadow-xl">
              💎 Scopri tutti i pacchetti
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-orange rounded-2xl p-12 text-center text-white animate-fadeIn delay-200">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto a trasformare la tua azienda?
          </h2>
          <p className="text-lg text-orange-100 mb-8 max-w-2xl mx-auto">
            Unisciti a centinaia di imprenditori che hanno già portato la loro 
            azienda al livello successivo con V6 Impresa AI.
          </p>
          <Link href="/intervista">
            <Button 
              variant="secondary" 
              size="lg" 
              className="bg-white text-orange-600 hover:bg-orange-50 border-white"
            >
              🚀 Inizia la tua trasformazione
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

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
