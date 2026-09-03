'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@erpv6/ui';
import { Card } from '@erpv6/ui';
import { Badge } from '@erpv6/ui';
import { Loader2, ArrowRight, ArrowLeft, Users } from 'lucide-react';

// Fase 1 — Acquisizione dati minimi (Denis, 30/08/2026: "nome email
// cellulare azienda, dopo di questa domanda dovrebbe fermarsi ed iniziare
// l'intervista intelligente quella ad albero"). SOLO questi 4 dati: non
// settore/fatturato/dipendenti/tipoProgetto/ecc. come nella vecchia form a
// 5 fasi/19 domande -- quei dati sono gia' raccolti (meglio, con verticale
// reale da erpv6.vertical.catalog) dall'intervista ad albero vera
// (/intervista/guidata, InterviewTreeFlow.tsx), mai duplicati qui.
const questions = [
  { id: 'nome', label: 'Come ti chiami?', type: 'text', placeholder: 'Mario Rossi', required: true },
  { id: 'email', label: 'La tua email', type: 'email', placeholder: 'mario@esempio.it', required: true },
  { id: 'telefono', label: 'Il tuo telefono', type: 'tel', placeholder: '+39 333 1234567', required: false },
  { id: 'azienda', label: 'Nome della tua azienda', type: 'text', placeholder: 'Innovazione S.r.l.', required: true },
] as const;

type Answers = Partial<Record<(typeof questions)[number]['id'], string>>;

async function createPartialLead(data: Record<string, unknown>): Promise<{ success: boolean; leadId?: number }> {
  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'intervista', data, partial: true }),
    });
    const body = await response.json().catch(() => null);
    return response.ok && body?.success ? { success: true, leadId: body.leadId } : { success: false };
  } catch {
    return { success: false };
  }
}

function InterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');
  const packageName = searchParams.get('packageName');

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [redirecting, setRedirecting] = useState(false);

  const progress = ((currentQuestion + (redirecting ? 1 : 0)) / questions.length) * 100;

  const goToGuidata = async (finalAnswers: Answers) => {
    setRedirecting(true);
    const result = await createPartialLead({ ...finalAnswers, package: packageName, packageId });
    const guidataParams = new URLSearchParams();
    if (result.success && result.leadId) guidataParams.set('lead_id', String(result.leadId));
    if (finalAnswers.nome) guidataParams.set('name', finalAnswers.nome);
    if (finalAnswers.email) guidataParams.set('email', finalAnswers.email);
    const query = guidataParams.toString();
    router.push(`/intervista/guidata${query ? `?${query}` : ''}`);
  };

  const handleAnswer = (value: string) => {
    const q = questions[currentQuestion];
    const updatedAnswers: Answers = { ...answers, [q.id]: value };
    setAnswers(updatedAnswers);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      return;
    }
    // Fase 1 completa (ultima delle 4 domande risposta): stop, si passa
    // SUBITO all'intervista intelligente ad albero -- mai un'altra domanda
    // qui, per decisione esplicita di Denis.
    goToGuidata(updatedAnswers);
  };

  const goBack = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  };

  if (redirecting) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Passiamo all&apos;intervista su misura per il tuo progetto…</p>
        </div>
      </main>
    );
  }

  const q = questions[currentQuestion];

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container max-w-2xl mx-auto px-4">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="primary" className="bg-orange-500 text-white">
              Profilo Aziendale • Domanda {currentQuestion + 1} di {questions.length}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={16} className="text-orange-500" />
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-sm text-gray-500 mb-2">Parliamo della tua azienda</p>
          <h3 className="text-2xl font-bold text-gray-900 mb-6">{q.label}</h3>

          <div>
            <input
              type={q.type}
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              placeholder={q.placeholder}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20"
              required={q.required}
            />
            <div className="flex justify-end mt-4">
              <Button onClick={() => handleAnswer(answers[q.id] || '')}>
                Avanti <ArrowRight size={18} />
              </Button>
            </div>
          </div>

          {currentQuestion > 0 && (
            <button onClick={goBack} className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft size={14} /> Indietro
            </button>
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
