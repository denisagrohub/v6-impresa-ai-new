'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@erpv6/ui';
import { Card } from '@erpv6/ui';
import { Badge } from '@erpv6/ui';
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, Target, TrendingUp, Users, Shield, Gauge, Rocket } from 'lucide-react';
import { interviewEngine, type InterviewAnswer, type InterviewResult } from '@/lib/interview/interview-engine';

// Definizione delle fasi
const phases = [
  {
    id: 'profile',
    name: 'Profilo Aziendale',
    icon: Users,
    description: 'Parliamo della tua azienda',
    questions: [
      { id: 'nome', label: 'Come ti chiami?', type: 'text', placeholder: 'Mario Rossi', required: true },
      { id: 'email', label: 'La tua email', type: 'email', placeholder: 'mario@esempio.it', required: true },
      { id: 'telefono', label: 'Il tuo telefono', type: 'tel', placeholder: '+39 333 1234567', required: false },
      { id: 'azienda', label: 'Nome della tua azienda', type: 'text', placeholder: 'Innovazione S.r.l.', required: true },
      { id: 'settore', label: 'Settore di appartenenza', type: 'text', placeholder: 'Tech, Manifatturiero, Food...', required: true },
      { id: 'fatturato', label: 'Fatturato annuo', type: 'select', options: ['< 1M€', '1M€ - 5M€', '5M€ - 10M€', '> 10M€'], required: true },
      { id: 'dipendenti', label: 'Numero di dipendenti', type: 'select', options: ['< 5', '5 - 20', '20 - 50', '> 50'], required: true },
    ]
  },
  {
    id: 'project',
    name: 'Il Progetto',
    icon: Target,
    description: 'Cosa vuoi realizzare?',
    questions: [
      { id: 'tipoProgetto', label: 'Tipo di progetto', type: 'select', options: ['Business Plan base', 'Piano industriale', 'Project Finance / M&A', 'Passaggio generazionale', 'Ristrutturazione debito'], required: true },
      { id: 'destinatario', label: 'A chi è destinato il business plan?', type: 'select', options: ['Banca', 'Investitore', 'Partner', 'Interno'], required: true },
      { id: 'tempistiche', label: 'Tempistiche previste', type: 'select', options: ['Immediata (< 1 mese)', 'Breve (1-3 mesi)', 'Media (3-6 mesi)', 'Lunga (> 6 mesi)'], required: true },
      { id: 'budget', label: 'Budget disponibile', type: 'select', options: ['< €5.000', '€5.000 - €10.000', '€10.000 - €25.000', '> €25.000'], required: true },
      { id: 'obiettivi', label: 'Quali sono i tuoi obiettivi principali?', type: 'textarea', placeholder: 'Descrivi gli obiettivi del progetto...', required: true },
    ]
  },
  {
    id: 'financial',
    name: 'Dati Finanziari',
    icon: TrendingUp,
    description: 'Qualche numero per capire meglio',
    questions: [
      { id: 'fatturatoAttuale', label: 'Fatturato attuale (ultimo anno)', type: 'text', placeholder: '€1.500.000', required: false },
      { id: 'ebitda', label: 'EBITDA (Margine operativo)', type: 'text', placeholder: '€250.000 o 15%', required: false },
      { id: 'investimentiPrevisti', label: 'Investimenti previsti (3 anni)', type: 'text', placeholder: '€500.000', required: false },
      { id: 'fabbisognoFinanziario', label: 'Fabbisogno finanziario richiesto', type: 'text', placeholder: '€1.000.000', required: false },
    ]
  },
  {
    id: 'market',
    name: 'Mercato & Competitor',
    icon: Gauge,
    description: 'Il contesto in cui operi',
    questions: [
      { id: 'mercatoTarget', label: 'Mercato target (clienti ideali)', type: 'textarea', placeholder: 'Descrivi il tuo mercato di riferimento...', required: false },
      { id: 'competitorPrincipali', label: 'Principali competitor', type: 'textarea', placeholder: 'Chi sono i tuoi competitor diretti...', required: false },
      { id: 'vantaggioCompetitivo', label: 'Vantaggio competitivo', type: 'textarea', placeholder: 'Cosa ti differenzia dalla concorrenza...', required: false },
    ]
  },
  {
    id: 'results',
    name: 'Risultati',
    icon: Rocket,
    description: 'Il tuo business plan su misura',
    questions: []
  }
];

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');
  const packageName = searchParams.get('packageName');
  const isAssessment = searchParams.get('assessment') === 'true';

  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Partial<InterviewAnswer>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const phase = phases[currentPhase];
  const questions = phase.questions;
  const totalQuestions = phases.reduce((acc, p) => acc + p.questions.length, 0);
  const answeredSoFar = phases.slice(0, currentPhase).reduce((acc, p) => acc + p.questions.length, 0) + currentQuestion;
  const progress = (answeredSoFar / totalQuestions) * 100;

  const handleAnswer = (value: string) => {
    const q = questions[currentQuestion];
    setAnswers({ ...answers, [q.id]: value });
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentPhase < phases.length - 1) {
      setCurrentPhase(currentPhase + 1);
      setCurrentQuestion(0);
    } else {
      submitAnswers();
    }
  };

  const goBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    } else if (currentPhase > 0) {
      setCurrentPhase(currentPhase - 1);
      const prevPhase = phases[currentPhase - 1];
      setCurrentQuestion(prevPhase.questions.length - 1);
    }
  };

  const submitAnswers = async () => {
    setLoading(true);
    try {
      const fullAnswers = answers as InterviewAnswer;
      const result = interviewEngine.calculateScore(fullAnswers);
      setResult(result);

      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'intervista',
          data: {
            ...fullAnswers,
            package: packageName || result.recommendedLevel,
            packageId: packageId || result.recommendedLevel,
            score: result.score,
            recommendedLevel: result.recommendedLevel,
            estimatedPrice: result.estimatedPrice,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Errore:', error);
      alert('Errore durante l\'invio. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted && result) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
        <div className="container max-w-2xl mx-auto px-4">
          <Card className="p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">🎉 Intervista Completata!</h2>
              <p className="text-gray-600 mt-2">Ecco il tuo report personalizzato</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Il tuo V6 Score</div>
                  <div className="text-4xl font-bold text-orange-500">{result.score}/100</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Pacchetto consigliato</div>
                  <div className="text-2xl font-bold text-[#1a2744]">{result.recommendedLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Stima prezzo</div>
                  <div className="text-2xl font-bold text-orange-500">
                    {result.estimatedPrice >= 100000 
                      ? `€${(result.estimatedPrice / 1000).toFixed(0)}k` 
                      : `€${result.estimatedPrice.toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-gray-700">{result.summary}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="font-bold text-green-600 mb-2">✅ Punti di forza</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  {result.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-red-600 mb-2">⚠️ Aree di miglioramento</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  {result.weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <h4 className="font-bold text-blue-800 mb-2">📋 Prossimi passi</h4>
              <ul className="space-y-1 text-sm text-blue-800">
                {result.nextSteps.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contatti">
                <Button size="lg" fullWidth>📞 Richiedi Consulenza</Button>
              </Link>
              <Link href="/premium">
                <Button variant="secondary" size="lg" fullWidth>💎 Vedi Pacchetti</Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  const q = questions[currentQuestion];
  if (!q) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container max-w-2xl mx-auto px-4">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="primary" className="bg-orange-500 text-white">
              {phase.name} • Domanda {currentQuestion + 1} di {questions.length}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <phase.icon size={16} className="text-orange-500" />
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-sm text-gray-500 mb-2">{phase.description}</p>
          <h3 className="text-2xl font-bold text-gray-900 mb-6">{q.label}</h3>

          {q.type === 'select' ? (
            <div className="space-y-3">
              {q.options?.map((opt: string) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all"
                >
                  <span className="text-gray-700">{opt}</span>
                </button>
              ))}
            </div>
          ) : q.type === 'textarea' ? (
            <div>
              <textarea
                value={(answers[q.id as keyof InterviewAnswer] as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder={q.placeholder}
                rows={4}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 resize-none"
              />
              <div className="flex justify-end mt-4">
                <Button onClick={() => handleAnswer((answers[q.id as keyof InterviewAnswer] as string) || '')}>
                  Avanti <ArrowRight size={18} />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <input
                type={q.type}
                value={(answers[q.id as keyof InterviewAnswer] as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder={q.placeholder}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20"
                required={q.required}
              />
              <div className="flex justify-end mt-4">
                <Button onClick={() => handleAnswer((answers[q.id as keyof InterviewAnswer] as string) || '')}>
                  Avanti <ArrowRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {(currentPhase > 0 || currentQuestion > 0) && (
            <button onClick={goBack} className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft size={14} /> Indietro
            </button>
          )}

          {loading && (
            <div className="flex justify-center mt-4">
              <Loader2 size={24} className="animate-spin text-orange-500" />
            </div>
          )}
        </Card>

        <p className="text-xs text-gray-500 text-center mt-4">
          🔒 I tuoi dati sono al sicuro. Non li condivideremo con terzi.
        </p>
      </div>
    </main>
  );
}

export default function IntervistaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={48} className="animate-spin text-orange-500" /></div>}>
      <InterviewContent />
    </Suspense>
  );
}
