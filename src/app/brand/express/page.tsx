'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader2 } from 'lucide-react';

export default function BrandExpressPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    sector: '',
    discProfile: 'C',
    target: 'professionisti',
    mission: '',
  });

  const questions = [
    { id: 'companyName', label: 'Nome della tua azienda', type: 'text' },
    { id: 'sector', label: 'Settore di appartenenza', type: 'text' },
    { id: 'discProfile', label: 'Quale profilo DISC ti riconosci?', type: 'select', options: ['D (Dominante)', 'I (Influente)', 'S (Stabile)', 'C (Coscienzioso)'] },
    { id: 'target', label: 'Chi è il tuo cliente ideale?', type: 'select', options: ['Giovani', 'Professionisti', 'Famiglie', 'Lusso', 'Wellness', 'Food'] },
    { id: 'mission', label: 'Qual è la missione del tuo brand?', type: 'textarea' },
  ];

  const handleChange = (e: any) => {
    setFormData({ ...formData, [questions[step].id]: e.target.value });
  };

  const handleNext = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        const response = await fetch('/api/brand/express', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await response.json();
        if (data.success) {
          sessionStorage.setItem('brandReport', JSON.stringify(data.result));
          router.push('/brand/express/report');
        }
      } catch (error) {
        console.error(error);
        alert('Errore generazione report');
      } finally {
        setLoading(false);
      }
    }
  };

  const q = questions[step];

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container max-w-2xl mx-auto px-4">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Brand Express</h2>
            <span className="text-sm text-gray-500">Domanda {step+1} di {questions.length}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${((step+1)/questions.length)*100}%` }} />
          </div>

          <h3 className="text-xl font-medium mb-4">{q.label}</h3>
          {q.type === 'select' ? (
            <select value={formData[q.id as keyof typeof formData] as string} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl">
              <option value="">Seleziona...</option>
              {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : q.type === 'textarea' ? (
            <textarea rows={4} value={formData[q.id as keyof typeof formData] as string} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl" />
          ) : (
            <input type="text" value={formData[q.id as keyof typeof formData] as string} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl" />
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={handleNext} disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              {step === questions.length - 1 ? 'Genera Report' : 'Avanti'}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
