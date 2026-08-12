'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@erpv6/ui';
import { Card } from '@erpv6/ui';
import { Loader2, Download, Share2 } from 'lucide-react';

export default function BrandExpressReport() {
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = sessionStorage.getItem('brandReport');
    if (data) {
      setReport(JSON.parse(data));
    } else {
      router.push('/brand/express');
    }
    setLoading(false);
  }, [router]);

  if (loading || !report) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={48} /></div>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">📊 Report Brand Express</h1>
        <Card className="p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-gray-700">Nome Azienda</h3>
              <p>{report.companyName}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-700">Settore</h3>
              <p>{report.sector}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-700">Profilo DISC</h3>
              <p>{report.discProfile}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-700">Target</h3>
              <p>{report.target}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h3 className="font-bold text-xl mb-4">🎨 Palette Colori</h3>
          <div className="flex gap-4">
            {Object.entries(report.palette).map(([key, color]) => (
              <div key={key} className="text-center">
                <div className="w-16 h-16 rounded-full border" style={{ backgroundColor: color as string }} />
                <span className="text-xs block mt-1">{key}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h3 className="font-bold text-xl mb-4">📝 Brand Story</h3>
          <p className="text-gray-700">{report.story}</p>
        </Card>

        <div className="flex gap-4">
          <Button onClick={() => alert('Download PDF')}><Download size={18} className="mr-2" /> Scarica PDF</Button>
          <Button variant="secondary" onClick={() => alert('Condividi')}><Share2 size={18} className="mr-2" /> Condividi</Button>
        </div>
      </div>
    </main>
  );
}
