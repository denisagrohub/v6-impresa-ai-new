'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@erpv6/ui';
import { Card } from '@erpv6/ui';
import { Badge } from '@erpv6/ui';
import { 
  Loader2, CheckCircle2, PenLine, MessageSquare, Video, 
  Send, FileText, Clock, AlertCircle, Users, Star
} from 'lucide-react';
import Link from 'next/link';

function ConsultantBPReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bpId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [bpData, setBpData] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'reviewing' | 'approved' | 'rejected'>('pending');
  const [feedback, setFeedback] = useState('');
  const [callScheduled, setCallScheduled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [checklist, setChecklist] = useState({
    metodologia: false,
    datiFinanziari: false,
    analisiMercato: false,
    coerenza: false,
    chiarezza: false,
    branding: false,
  });

  useEffect(() => {
    if (!bpId) {
      router.push('/consultant/dashboard');
      return;
    }

    fetch(`/api/bp/${bpId}`)
      .then(res => res.json())
      .then(data => {
        setBpData(data);
        setLoading(false);
      })
      .catch(() => {
        setBpData({
          id: bpId,
          title: 'Innovazione S.r.l. - Business Plan V6',
          cliente: 'Mario Rossi',
          packageLevel: 'L2',
          audience: 'bank',
          price: 5500,
          sections: [
            { id: 'executiveSummary', title: 'Executive Summary', content: 'Contenuto...', order: 1 },
            { id: 'companyDescription', title: 'Descrizione Azienda', content: 'Contenuto...', order: 2 },
          ],
          createdAt: '2026-07-20T10:00:00Z',
        });
        setLoading(false);
      });
  }, [bpId, router]);

  const handleScheduleCall = () => {
    setCallScheduled(true);
    fetch('/api/consultant/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Revisione BP - ${bpData?.cliente}`,
        projectId: bpId,
        type: 'review',
        duration: 60,
        notes: 'Call di revisione Business Plan',
      }),
    });
  };

  const handleSubmitReview = async () => {
    const allChecked = Object.values(checklist).every(v => v === true);
    if (!allChecked) {
      alert('Completa tutti i punti della checklist prima di procedere');
      return;
    }

    setSubmitting(true);
    try {
      await fetch(`/api/bp/${bpId}/consultant-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewStatus === 'approved' ? 'approved' : 'revision_needed',
          feedback,
          checklist,
          callScheduled,
        }),
      });

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bp_consultant_reviewed',
          bpId,
          message: reviewStatus === 'approved' 
            ? 'Il consulente ha approvato il Business Plan' 
            : 'Il consulente ha richiesto modifiche',
        }),
      });

      router.push('/consultant/dashboard?review=success');
    } catch (error) {
      alert('Errore durante l\'invio');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={48} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revisione Business Plan</h1>
            <p className="text-gray-500 mt-1">
              {bpData?.cliente} • {bpData?.packageLevel}
            </p>
          </div>
          <Badge variant="primary" className="bg-orange-500 text-white">
            Revisione Consulente
          </Badge>
        </div>

        {!callScheduled && (
          <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Video size={24} className="text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">📅 Programma la Call di Revisione</div>
                  <div className="text-sm text-gray-600">
                    Una call di 60 minuti con il cliente per discutere il BP
                  </div>
                </div>
              </div>
              <Button onClick={handleScheduleCall}>
                <Video size={18} className="mr-2" /> Programma Call
              </Button>
            </div>
          </Card>
        )}

        {callScheduled && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <span className="text-green-800">✅ Call di revisione programmata</span>
          </div>
        )}

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-orange-500" />
            Checklist Revisione V6
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { id: 'metodologia', label: '✅ Coerenza con Metodo V6' },
              { id: 'datiFinanziari', label: '✅ Dati finanziari validi e coerenti' },
              { id: 'analisiMercato', label: '✅ Analisi di mercato completa' },
              { id: 'coerenza', label: '✅ Coerenza tra sezioni' },
              { id: 'chiarezza', label: '✅ Chiarezza espositiva' },
              { id: 'branding', label: '✅ Allineamento con il brand' },
            ].map((item) => (
              <label key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={checklist[item.id as keyof typeof checklist]}
                  onChange={(e) => setChecklist({ ...checklist, [item.id]: e.target.checked })}
                  className="w-5 h-5 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-orange-500" />
            Feedback Consulente
          </h3>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={5}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 resize-none"
            placeholder="Inserisci il feedback per il cliente e eventuali modifiche da apportare..."
          />
          <p className="text-xs text-gray-500 mt-2">
            Il feedback sarà visibile al cliente durante la revisione self-service
          </p>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => {
              setReviewStatus('approved');
              handleSubmitReview();
            }}
            disabled={submitting || !callScheduled}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Approva e Invia al Cliente
          </Button>
          <Button
            onClick={() => {
              setReviewStatus('rejected');
              handleSubmitReview();
            }}
            disabled={submitting || !callScheduled}
            variant="secondary"
            className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />}
            Richiedi Modifiche
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          <Users size={12} className="inline mr-1" />
          La revisione del consulente garantisce la qualità del documento
        </p>
      </div>
    </main>
  );
}

export default function ConsultantBPReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={48} className="animate-spin text-orange-500" /></div>}>
      <ConsultantBPReviewContent />
    </Suspense>
  );
}
