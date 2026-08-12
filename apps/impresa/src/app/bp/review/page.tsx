'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@erpv6/ui';
import { Card } from '@erpv6/ui';
import { Badge } from '@erpv6/ui';
import { 
  Loader2, CheckCircle2, XCircle, PenLine, MessageSquare, 
  Send, FileText, Clock, AlertCircle, Lock, Shield
} from 'lucide-react';
import Link from 'next/link';

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bpId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [bpData, setBpData] = useState<any>(null);
  const [status, setStatus] = useState<'review' | 'approved' | 'rejected'>('review');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bpId) {
      router.push('/dashboard');
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
          packageLevel: 'L2',
          audience: 'bank',
          price: 5500,
          estimatedDelivery: '5 giorni',
          status: 'draft',
          sections: [
            { id: 'executiveSummary', title: 'Executive Summary', content: 'Contenuto...', order: 1 },
            { id: 'companyDescription', title: 'Descrizione Azienda', content: 'Contenuto...', order: 2 },
          ],
          createdAt: '2026-07-20T10:00:00Z',
        });
        setLoading(false);
      });
  }, [bpId, router]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/bp/${bpId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, approved: true }),
      });
      setStatus('approved');
      
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bp_approved',
          bpId,
          message: 'Il cliente ha approvato il Business Plan',
        }),
      });
      
    } catch (error) {
      alert('Errore durante l\'approvazione');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      alert('Inserisci il motivo del rifiuto');
      return;
    }
    setSubmitting(true);
    try {
      await fetch(`/api/bp/${bpId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, approved: false }),
      });
      setStatus('rejected');
      
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bp_rejected',
          bpId,
          message: 'Il cliente ha richiesto modifiche',
          feedback,
        }),
      });
      
    } catch (error) {
      alert('Errore durante il rifiuto');
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

  if (!bpData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Business Plan non trovato</h2>
          <Link href="/dashboard" className="text-orange-500 hover:underline mt-4 inline-block">
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={48} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">✅ Business Plan Approvato!</h2>
          <p className="text-gray-600">
            Il tuo Business Plan è stato approvato. Il consulente procederà con la certificazione blockchain e la consegna.
          </p>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-left text-sm text-blue-800">
            <strong>Prossimi passi:</strong>
            <ul className="mt-2 space-y-1">
              <li>• Certificazione su Blockchain</li>
              <li>• Fatturazione del SAL corrente</li>
              <li>• Consegna documento finale</li>
            </ul>
          </div>
          <Link href="/dashboard">
            <Button className="mt-6" fullWidth>Torna alla Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <PenLine size={48} className="text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">📝 Richiesta Modifiche</h2>
          <p className="text-gray-600 mb-4">
            Le tue richieste di modifica sono state inviate al consulente.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-700">
            <strong>Il tuo feedback:</strong>
            <p className="mt-2 text-gray-600">{feedback}</p>
          </div>
          <Link href="/dashboard">
            <Button className="mt-6" fullWidth variant="secondary">Torna alla Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revisione Business Plan</h1>
            <p className="text-gray-500 mt-1">
              Leggi attentamente il documento. Puoi approvarlo o richiedere modifiche.
            </p>
          </div>
          <Badge variant="primary" className="bg-blue-500 text-white">
            Revisione Cliente
          </Badge>
        </div>

        <Card className="p-6 mb-6 bg-gradient-to-r from-orange-50 to-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Pacchetto</div>
              <div className="font-bold text-gray-900">{bpData.packageLevel || 'L2'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Prezzo</div>
              <div className="font-bold text-orange-600">€{bpData.price?.toLocaleString() || '5.500'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Consegna stimata</div>
              <div className="font-bold text-gray-900">{bpData.estimatedDelivery || '5 giorni'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Creato il</div>
              <div className="font-bold text-gray-900">
                {new Date(bpData.createdAt).toLocaleDateString('it-IT')}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4 mb-8">
          {bpData.sections?.map((section: any) => (
            <Card key={section.id} className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{section.title}</h2>
              <div className="prose prose-sm max-w-none text-gray-700">
                <p>{section.content}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-orange-500" />
            Feedback
          </h3>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note aggiuntive (opzionale)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 resize-none"
              placeholder="Inserisci eventuali commenti o richieste di modifica..."
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Approva Business Plan
            </Button>
            <Button
              onClick={handleReject}
              disabled={submitting}
              variant="secondary"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
              Richiedi Modifiche
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-4">
            <Shield size={12} className="inline mr-1" />
            La tua approvazione certificherà il documento su blockchain
          </p>
        </Card>
      </div>
    </main>
  );
}

export default function BPReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={48} className="animate-spin text-orange-500" /></div>}>
      <ReviewContent />
    </Suspense>
  );
}
