'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Badge } from '@erpv6/ui';
import { CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

type Option = { label: string; score: 0 | 1 | 2 };
type Question = { id: string; label: string; options: [Option, Option, Option] };

const questions: Question[] = [
  {
    id: 'business-plan',
    label: 'La tua azienda ha un business plan aggiornato negli ultimi 12 mesi?',
    options: [
      { label: 'Sì, è aggiornato', score: 2 },
      { label: 'Esiste ma ha più di 2 anni', score: 1 },
      { label: 'Non esiste', score: 0 },
    ],
  },
  {
    id: 'dscr',
    label: 'Conosci il DSCR (indice di copertura del debito) della tua azienda?',
    options: [
      { label: 'Sì, lo monitoro regolarmente', score: 2 },
      { label: 'Ne ho sentito parlare, non lo calcolo', score: 1 },
      { label: 'No, non so cosa sia', score: 0 },
    ],
  },
  {
    id: 'bilanci',
    label: 'I bilanci degli ultimi 3 anni sono in regola e reperibili rapidamente?',
    options: [
      { label: 'Sì, sempre pronti', score: 2 },
      { label: 'Ci vuole tempo per raccoglierli', score: 1 },
      { label: 'Non sono sicuro siano in regola', score: 0 },
    ],
  },
  {
    id: 'dati-digitali',
    label: 'Registri i dati di produzione e i costi con un gestionale digitale?',
    options: [
      { label: 'Sì, con un gestionale dedicato', score: 2 },
      { label: 'Solo fogli Excel sparsi', score: 1 },
      { label: 'Ancora su carta', score: 0 },
    ],
  },
  {
    id: 'eco-schemi',
    label: 'Sai già quali eco-schemi e impegni ambientali PAC si applicano a te?',
    options: [
      { label: 'Sì, li applico consapevolmente', score: 2 },
      { label: 'Ne ho una vaga idea', score: 1 },
      { label: 'No', score: 0 },
    ],
  },
  {
    id: 'passaggio-generazionale',
    label: 'Se dovessi passare l’azienda a un successore domani, la documentazione è in ordine?',
    options: [
      { label: 'Sì, tutto in ordine', score: 2 },
      { label: 'Parzialmente', score: 1 },
      { label: 'No, temo criticità', score: 0 },
    ],
  },
  {
    id: 'diversificazione',
    label: 'Quanta parte del reddito viene da fonti diverse dalla sola vendita del prodotto grezzo?',
    options: [
      { label: 'Oltre il 20%', score: 2 },
      { label: 'Meno del 20%', score: 1 },
      { label: 'Nessuna diversificazione', score: 0 },
    ],
  },
  {
    id: 'ismea',
    label: 'Hai già valutato strumenti di garanzia pubblica (es. ISMEA) per nuovi finanziamenti?',
    options: [
      { label: 'Sì, li ho usati o valutati con un consulente', score: 2 },
      { label: 'Ne ho sentito parlare', score: 1 },
      { label: 'No', score: 0 },
    ],
  },
  {
    id: 'assicurazioni',
    label: 'Hai una copertura assicurativa agevolata contro i rischi climatici, attiva e aggiornata?',
    options: [
      { label: 'Sì, attiva e aggiornata', score: 2 },
      { label: 'Ce l’ho ma non sono sicuro copra i rischi attuali', score: 1 },
      { label: 'No', score: 0 },
    ],
  },
  {
    id: 'tracciabilita',
    label: 'In caso di controllo, sei in grado di dimostrare subito tracciabilità e conformità?',
    options: [
      { label: 'Sì, sempre pronto', score: 2 },
      { label: 'Con qualche giorno di preparazione', score: 1 },
      { label: 'Non ne sono sicuro', score: 0 },
    ],
  },
  {
    id: 'consulenza',
    label: 'Hai un consulente che segue specificamente le pratiche PAC della tua azienda?',
    options: [
      { label: 'Sì, dedicato e aggiornato sulla PAC 2028', score: 2 },
      { label: 'Ho un consulente generico', score: 1 },
      { label: 'No, faccio da solo', score: 0 },
    ],
  },
  {
    id: 'innovazione',
    label: 'Hai investito o pianificato investimenti in innovazione tecnologica negli ultimi 2 anni?',
    options: [
      { label: 'Sì, investimenti concreti', score: 2 },
      { label: 'Ci sto pensando', score: 1 },
      { label: 'No', score: 0 },
    ],
  },
];

type Zone = 'rosso' | 'giallo' | 'verde';

const zoneInfo: Record<Zone, { title: string; text: string; badgeClass: string }> = {
  rosso: {
    title: 'Zona Rossa',
    text:
      'La tua azienda ha diverse aree scoperte in vista della PAC 2028: rischi concreti su accesso ai fondi e continuità del debito. Prima si interviene, più opzioni restano aperte.',
    badgeClass: 'bg-red-600 text-white',
  },
  giallo: {
    title: 'Zona Gialla',
    text:
      'Le basi ci sono, ma alcuni punti vanno strutturati prima del 2028 per non perdere terreno rispetto a chi si sta già muovendo.',
    badgeClass: 'bg-amber-500 text-white',
  },
  verde: {
    title: 'Zona Verde',
    text:
      'La tua azienda è in una buona posizione di partenza. Il passo successivo è validare i punti deboli residui con un confronto mirato.',
    badgeClass: 'bg-brand text-white',
  },
};

function zoneFromScore(score: number): Zone {
  if (score >= 17) return 'verde';
  if (score >= 9) return 'giallo';
  return 'rosso';
}

export default function PacChecklist() {
  const [answers, setAnswers] = useState<Record<string, 0 | 1 | 2>>({});
  const [showResult, setShowResult] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const totalScore = useMemo(
    () => Object.values(answers).reduce((sum: number, v) => sum + v, 0),
    [answers]
  );
  const zone = zoneFromScore(totalScore);

  const selectAnswer = (questionId: string, score: 0 | 1 | 2) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
    setShowResult(false);
  };

  const reset = () => {
    setAnswers({});
    setShowResult(false);
  };

  if (showResult) {
    const info = zoneInfo[zone];
    return (
      <Card hover={false} className="max-w-2xl mx-auto text-center p-8 border-stone-200">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} className="text-brand" aria-hidden="true" />
        </div>
        <Badge className={`${info.badgeClass} mb-4 text-sm px-3 py-1`}>
          {info.title}
        </Badge>
        <div className="text-5xl font-bold text-stone-900 mb-2">
          {totalScore} / 24
        </div>
        <p className="text-stone-600 mb-8 leading-relaxed">{info.text}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            variant="outline"
            className="border-brand text-brand hover:bg-green-50 focus-visible:ring-brand gap-2"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Rifai la checklist
          </Button>
          <Link href="#prenota-call">
            <Button className="bg-brand hover:bg-green-800 focus-visible:ring-brand gap-2 w-full sm:w-auto">
              Prenota una call sul risultato
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-sm font-medium text-stone-600">
        <span>{answeredCount} di {questions.length} completate</span>
        <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
      </div>
      <div className="w-full h-2 bg-stone-200 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      <div className="space-y-5">
        {questions.map((q, index) => (
          <Card key={q.id} hover={false} className="p-5 border-stone-200">
            <h3 className="font-semibold text-stone-900 mb-3">
              <span className="text-brand mr-2">{index + 1}.</span>
              {q.label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.score;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => selectAnswer(q.id, opt.score)}
                    aria-pressed={selected}
                    className={`text-left px-3 py-2.5 rounded-lg border-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                      selected
                        ? 'border-brand bg-green-50 text-green-900 font-medium'
                        : 'border-stone-200 text-stone-700 hover:border-green-300 hover:bg-stone-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button
          size="lg"
          disabled={!allAnswered}
          onClick={() => setShowResult(true)}
          className="bg-brand hover:bg-green-800 focus-visible:ring-brand"
        >
          {allAnswered
            ? 'Calcola il tuo risultato'
            : `Rispondi a tutte le domande (${answeredCount}/${questions.length})`}
        </Button>
      </div>
    </div>
  );
}
