'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, CheckCircle2, ArrowRight, Target, TrendingUp, Users, Shield, Gauge, Rocket } from 'lucide-react';

const questions = [
  { id: 'strategia', label: 'Hai una strategia chiara per i prossimi 3-5 anni?', icon: Target, options: ['Sì, molto chiara', 'Abbastanza chiara', 'In fase di definizione', 'Non ho una strategia'] },
  { id: 'finanza', label: 'Come valuti la tua situazione finanziaria?', icon: TrendingUp, options: ['Ottima', 'Buona', 'Stabile', 'Critica'] },
  { id: 'operazioni', label: 'I tuoi processi operativi sono efficienti?', icon: Gauge, options: ['Molto efficienti', 'Abbastanza', 'Migliorabili', 'Inefficienti'] },
  { id: 'persone', label: 'Il tuo team è allineato con gli obiettivi aziendali?', icon: Users, options: ['Completamente', 'Parzialmente', 'Poco', 'Non so'] },
  { id: 'conformita', label: 'Sei in regola con tutti gli aspetti normativi e fiscali?', icon: Shield, options: ['Sì, tutto in regola', 'Quasi tutto', 'Ci sono alcune criticità', 'Non lo so'] },
  { id: 'futuro', label: 'Hai un piano per la crescita o l\'uscita futura?', icon: Rocket, options: ['Sì, chiaro', 'In fase di definizione', 'Non ancora', 'No'] },
];

type QuestionId = 'strategia' | 'finanza' | 'operazioni' | 'persone' | 'conformita' | 'futuro';

const levelMapping: Record<QuestionId, Record<string, number>> = {
  strategia: { 'Sì, molto chiara': 4, 'Abbastanza chiara': 3, 'In fase di definizione': 2, 'Non ho una strategia': 1 },
  finanza: { 'Ottima': 4, 'Buona': 3, 'Stabile': 2, 'Critica': 1 },
  operazioni: { 'Molto efficienti': 4, 'Abbastanza': 3, 'Migliorabili': 2, 'Inefficienti': 1 },
  persone: { 'Completamente': 4, 'Parzialmente': 3, 'Poco': 2, 'Non so': 1 },
  conformita: { 'Sì, tutto in regola': 4, 'Quasi tutto': 3, 'Ci sono alcune criticità': 2, 'Non lo so': 1 },
  futuro: { 'Sì, chiaro': 4, 'In fase di definizione': 3, 'Non ancora': 2, 'No': 1 },
};

export default function V6Assessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; level: string; recommendation: string } | null>(null);

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [questions[step].id]: value });
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      calculateResult();
    }
  };

  const calculateResult = () => {
    let total = 0;
    for (const q of questions) {
      const qId = q.id as QuestionId;
      const answer = answers[qId];
      if (answer && levelMapping[qId] && levelMapping[qId][answer] !== undefined) {
        total += levelMapping[qId][answer];
      }
    }
    const avg = total / questions.length;

    let level = '';
    let recommendation = '';
    if (avg >= 3.5) {
      level = 'L2 - PMI';
      recommendation = 'La tua azienda è strutturata. Consigliamo il pacchetto L2 per scalare ulteriormente.';
    } else if (avg >= 2.5) {
      level = 'L1 - Startup';
      recommendation = 'Hai bisogno di strutturare la tua idea. Il pacchetto L1 è perfetto per te.';
    } else {
      level = 'L0 - Foundation';
      recommendation = 'Consigliamo una consulenza iniziale per definire le basi del tuo business.';
    }

    setResult({ score: avg, level, recommendation });
    setSubmitted(true);
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  };

  if (submitted && result) {
    return (
      <Card className="p-8 max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Il tuo V6 Score</h2>
        <div className="text-6xl font-bold text-orange-500 mb-2">{result.score.toFixed(1)} / 4.0</div>
        <div className="text-xl font-bold text-[#1a2744] mb-2">Pacchetto consigliato: {result.level}</div>
        <p className="text-gray-600 mb-6">{result.recommendation}</p>
        <div className="flex gap-4 justify-center">
          <Button onClick={reset} variant="secondary">Rifai il test</Button>
          <Link href="/contatti">
            <Button>Richiedi preventivo</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const q = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="primary" className="bg-orange-500 text-white">
          Domanda {step + 1} di {questions.length}
        </Badge>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <q.icon size={16} className="text-orange-500" />
          <span className="capitalize">{q.id}</span>
        </div>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-6">{q.label}</h3>
      <div className="space-y-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(opt)}
            className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all"
          >
            <span className="text-gray-700">{opt}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
