'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Loader2, CheckCircle2, TrendingUp, Target, 
  ArrowRight, Download, FileText, Sparkles,
  Check, AlertTriangle, Star, Clock, Users, Building2
} from 'lucide-react';
import Link from 'next/link';

function RisultatiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageName = searchParams.get('package') || 'Starter';
  const packagePrice = searchParams.get('price') || '€5.500';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const savedData = sessionStorage.getItem('interviewData');
    if (savedData) {
      setData(JSON.parse(savedData));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={48} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Nessun dato trovato</h2>
          <p className="text-gray-600 mt-2">Completa prima l'intervista.</p>
          <Button onClick={() => router.push('/intervista')} className="mt-4">
            Torna all'intervista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-700 font-medium text-sm mb-4">
            <Sparkles size={16} />
            Report Personalizzato
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Ecco il tuo Business Plan
          </h1>
          <p className="text-gray-600 mt-2">
            Basato sulle tue risposte, abbiamo generato un report personalizzato per il pacchetto Starter.
          </p>
        </div>

        <Card className="p-6 mb-6 bg-gradient-to-r from-orange-50 to-white border-2 border-orange-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white">
                <Star size={32} />
              </div>
              <div>
                <div className="text-sm text-gray-500">Pacchetto Selezionato</div>
                <div className="text-2xl font-bold text-gray-900">{packageName}</div>
                <div className="text-sm text-gray-600">
                  {packagePrice} • Consegna 5 giorni • 3 revisioni incluse
                </div>
              </div>
            </div>
            <Badge variant="primary" className="bg-green-500 text-white text-lg px-4 py-2">
              ✅ Confermato
            </Badge>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-orange-500" />
            Il tuo V6 Score
          </h2>
          <div className="flex items-center gap-6">
            <div className="text-5xl font-bold text-orange-500">
              {data.score || 68}/100
            </div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all"
                  style={{ width: `${data.score || 68}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Basso</span>
                <span>Medio</span>
                <span>Alto</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-orange-500" />
            Analisi Aziendale
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Fatturato</div>
                <div className="text-sm text-gray-600">{data.fatturato || '€3.5M'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <Users size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Dipendenti</div>
                <div className="text-sm text-gray-600">{data.dipendenti || '18'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl">
              <Target size={20} className="text-yellow-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Settore</div>
                <div className="text-sm text-gray-600">{data.settore || 'Food'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <TrendingUp size={20} className="text-blue-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Obiettivo</div>
                <div className="text-sm text-gray-600">{data.obiettivi || 'Espansione nazionale'}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card className="p-6 border-green-200">
            <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2">
              <Check size={18} /> Punti di Forza
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">• Fatturato in crescita del 15% annuo</li>
              <li className="flex items-start gap-2">• Team qualificato e motivato</li>
              <li className="flex items-start gap-2">• Posizionamento di mercato chiaro</li>
            </ul>
          </Card>
          <Card className="p-6 border-yellow-200">
            <h3 className="font-bold text-yellow-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} /> Aree di Miglioramento
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">• Analisi di mercato da approfondire</li>
              <li className="flex items-start gap-2">• Proiezioni finanziarie da dettagliare</li>
              <li className="flex items-start gap-2">• Strategia di marketing da definire</li>
            </ul>
          </Card>
        </div>

        <Card className="p-6 bg-gradient-to-r from-orange-50 to-white border-2 border-orange-200">
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-gray-900">{packagePrice}</div>
            <div className="text-sm text-gray-500">Consegna in 5 giorni lavorativi</div>
            <div className="text-sm text-gray-500">3 revisioni incluse</div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <Button 
              size="lg" 
              fullWidth 
              onClick={() => router.push('/checkout/starter')}
              className="bg-orange-500 hover:bg-orange-600"
            >
              🛒 Procedi al Pagamento
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              fullWidth
              onClick={() => router.push('/contatti')}
            >
              📞 Prenota Call Consulente
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-4">
            🔒 I tuoi dati sono al sicuro. Non li condivideremo con terzi.
          </p>
        </Card>
      </div>
    </main>
  );
}

export default function IntervistaRisultati() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={48} className="animate-spin text-orange-500" /></div>}>
      <RisultatiContent />
    </Suspense>
  );
}
