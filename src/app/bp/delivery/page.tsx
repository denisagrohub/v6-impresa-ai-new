'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Loader2, CheckCircle2, FileText, Download, 
  Share2, Shield, Lock, Clock, Check
} from 'lucide-react';
import Link from 'next/link';

function DeliveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bpId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [bpData, setBpData] = useState<any>(null);
  const [blockchainVerified, setBlockchainVerified] = useState(false);

  useEffect(() => {
    if (!bpId) {
      router.push('/dashboard');
      return;
    }

    fetch(`/api/bp/${bpId}/delivered`)
      .then(res => res.json())
      .then(data => {
        setBpData(data);
        if (data.blockchainHash) {
          setBlockchainVerified(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setBpData({
          id: bpId,
          title: 'Innovazione S.r.l. - Business Plan V6',
          packageLevel: 'L2',
          audience: 'bank',
          price: 5500,
          deliveryDate: '2026-07-25',
          blockchainHash: '0x7f8e9d3c...a1b2c3d4e5f6',
          documents: [
            { name: 'Business Plan V6.pdf', size: '4.2 MB', type: 'pdf' },
            { name: 'Financial Model.xlsx', size: '1.8 MB', type: 'xlsx' },
            { name: 'Pitch Deck.pptx', size: '3.5 MB', type: 'pptx' },
          ],
          nextSteps: [
            'Presentazione del BP alla banca',
            'Follow-up call con il consulente (tra 7 giorni)',
            'Aggiornamento trimestrale del financial model',
          ],
        });
        setBlockchainVerified(true);
        setLoading(false);
      });
  }, [bpId, router]);

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
          <h2 className="text-2xl font-bold text-gray-900">Documento non trovato</h2>
          <Link href="/dashboard" className="text-orange-500 hover:underline mt-4 inline-block">
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={48} className="text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">🎉 Business Plan Consegnato!</h1>
          <p className="text-gray-600 mt-2">
            Il tuo Business Plan è stato completato e certificato su blockchain.
          </p>
        </div>

        <Card className="p-6 mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Shield size={24} className="text-purple-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">Certificato su Blockchain</div>
                <div className="text-sm text-gray-600">
                  {blockchainVerified ? '✅ Verificato' : '⏳ In elaborazione'}
                </div>
              </div>
            </div>
            <Badge variant="primary" className="bg-purple-600 text-white">
              <Lock size={12} className="mr-1" /> Immutabile
            </Badge>
          </div>
          {bpData.blockchainHash && (
            <div className="mt-3 p-3 bg-white/80 rounded-lg text-xs font-mono text-gray-600 overflow-x-auto">
              Hash: {bpData.blockchainHash}
            </div>
          )}
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📦 Documenti Consegnati</h2>
          <div className="space-y-3">
            {bpData.documents?.map((doc: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-orange-500" />
                  <div>
                    <div className="font-medium text-gray-900">{doc.name}</div>
                    <div className="text-xs text-gray-500">{doc.size}</div>
                  </div>
                </div>
                <Button variant="secondary" size="sm">
                  <Download size={16} className="mr-1" /> Scarica
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-orange-500" />
            Prossimi Passi
          </h2>
          <ul className="space-y-2">
            {bpData.nextSteps?.map((step: string, i: number) => (
              <li key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <Check size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/dashboard" className="flex-1">
            <Button fullWidth variant="secondary">📊 Torna alla Dashboard</Button>
          </Link>
          <Button variant="primary" className="flex-1" onClick={() => alert('🔗 Link di condivisione copiato!')}>
            <Share2 size={18} className="mr-2" /> Condividi con la banca
          </Button>
        </div>
      </div>
    </main>
  );
}

// Wrapper con Suspense
export default function BPDeliveryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={48} className="animate-spin text-orange-500" /></div>}>
      <DeliveryContent />
    </Suspense>
  );
}
