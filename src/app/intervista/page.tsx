'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

function IntervistaContent() {
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
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'intervista',
          packageName: packageName,
          packageId: packageId,
          ...formData,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Errore invio');

      await fetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'admin@progettoimpresa.it',
          subject: `Nuova intervista - ${formData.nome} (${packageName})`,
          html: `<h2>Nuova richiesta preventivo</h2><p><strong>Pacchetto:</strong> ${packageName}</p><p><strong>Nome:</strong> ${formData.nome}</p><p><strong>Email:</strong> ${formData.email}</p><p><strong>Telefono:</strong> ${formData.telefono}</p><p><strong>Azienda:</strong> ${formData.azienda}</p><p><strong>Settore:</strong> ${formData.settore}</p><p><strong>Fatturato:</strong> ${formData.fatturato}</p><p><strong>Destinatario:</strong> ${formData.destinatario}</p><p><strong>Obiettivi:</strong> ${formData.obiettivi}</p>`,
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
              {q.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
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
            <Button onClick={handleNext} disabled={loading} className="flex items-center gap-2">
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

export default function IntervistaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>}>
      <IntervistaContent />
    </Suspense>
  );
}