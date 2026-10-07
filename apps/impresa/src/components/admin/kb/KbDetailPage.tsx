'use client';

// 06/10/2026 (C-kb-4): dettaglio KB read-only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft, BookOpen, Pencil } from 'lucide-react';
import KbEditModal from './KbEditModal';
import OtpVerifyModal from './OtpVerifyModal';
import { kbSessionHeader, type KbPurpose } from '@/lib/kb-session';

type KbDetail = {
  id: number;
  name: string;
  content: string;
  kb_type: string;
  description?: string;
  category_id?: number | null;
  access_level?: string;
  is_final?: boolean;
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
  // 07/10/2026 (C-kb-3c): modale edit + OTP write
  const [showEdit, setShowEdit] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [pendingPurpose, setPendingPurpose] = useState<KbPurpose>('write');
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [kbId, reloadKey]);

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
            {typeof data.is_final === 'boolean' && (
              <span className={`px-2 py-0.5 rounded ${
                data.is_final
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {data.is_final ? 'Pubblicata' : 'Bozza'}
              </span>
            )}
          </div>
        </div>
        {/* 07/10/2026 (C-kb-3c): modifica KB (OTP write) */}
        <button
          onClick={() => {
            if (kbSessionHeader('write')['X-Kb-Session']) {
              setShowEdit(true);
            } else {
              setPendingPurpose('write');
              setShowOtp(true);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          <Pencil className="w-3.5 h-3.5" />
          Modifica
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
          {data.content || '(contenuto vuoto)'}
        </pre>
      </div>

      {/* 07/10/2026 (C-kb-3c): modale OTP (apre KbEditModal dopo verify) */}
      {showOtp && (
        <OtpVerifyModal
          purpose={pendingPurpose}
          initialMessage={
            pendingPurpose === 'critical'
              ? 'Operazione critica: serve un nuovo codice OTP.'
              : 'Modifica KB: serve un codice OTP (valido 15 min).'
          }
          onVerified={() => {
            setShowOtp(false);
            setShowEdit(true);
          }}
          onClose={() => setShowOtp(false)}
        />
      )}

      {/* 07/10/2026 (C-kb-3c): editor KB */}
      {showEdit && data && (
        <KbEditModal
          mode="edit"
          initial={{
            id: data.id,
            name: data.name,
            kb_type: data.kb_type,
            category_id: data.category_id ?? null,
            description: data.description || '',
            content: data.content || '',
            access_level: data.access_level || 'consultant',
          }}
          onSaved={() => {
            setShowEdit(false);
            setReloadKey((k) => k + 1);
          }}
          onCancel={() => setShowEdit(false)}
          onNeedOtp={(purpose) => {
            setPendingPurpose(purpose);
            setShowEdit(false);
            setShowOtp(true);
          }}
        />
      )}
    </div>
  );
}
