'use client';

// 06/10/2026 (C-kb-4): dettaglio KB read-only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft, BookOpen } from 'lucide-react';

type KbDetail = {
  id: number;
  name: string;
  content: string;
  kb_type: string;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function KbDetailPage({ kbId }: { kbId: string }) {
  const [data, setData] = useState<KbDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/kb/detail/${kbId}`, { headers: authHeaders() });
        const j = await r.json();
        const payload = j.data || j;
        if (!r.ok || payload.error) {
          if (r.status === 403) throw new Error('Non hai accesso a questa KB.');
          if (r.status === 404) throw new Error('KB non trovata.');
          throw new Error(payload.error || `HTTP ${r.status}`);
        }
        setData(payload);
      } catch (e: any) {
        setError(e.message || 'Errore caricamento');
      } finally {
        setLoading(false);
      }
    })();
  }, [kbId]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento…
    </div>
  );

  if (error && !data) return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/admin/kb" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna alla lista
      </Link>
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>{error}</div>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/admin/kb" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna alla lista
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <BookOpen className="w-7 h-7 text-slate-700 mt-1" />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">{data.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-slate-500">#{data.id}</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">{data.kb_type}</span>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
          {data.content || '(contenuto vuoto)'}
        </pre>
      </div>
    </div>
  );
}
