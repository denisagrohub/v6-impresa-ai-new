'use client';

// 08/10/2026 (C-security-lead-public-bis): pagina pubblica conferma dati
// lead via link email /lead/<id>/edit?token=<TOKEN>.
// Legge ?token= via window.location.search (no Suspense boundary).
// PUT /api/lead-public/<id> con X-Lead-Token.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, Mail, Phone } from 'lucide-react';

type State = 'loading' | 'ready' | 'saving' | 'done' | 'error';

export default function LeadEditPage() {
  const params = useParams();
  const id = params?.id as string;
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<State>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadName, setLeadName] = useState('');

  // Leggo token da query string (client-only)
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('token');
      setToken(t);
    } catch {
      setToken(null);
    }
  }, []);

  // Preload info (dopo token)
  useEffect(() => {
    if (token === undefined) return;
    if (!token) {
      setErrMsg('Link non valido: token mancante.');
      setErrCode('missing');
      setState('error');
      return;
    }
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`/api/lead-public/${id}/info`, {
          headers: { 'X-Lead-Token': token },
        });
        const j = await r.json().catch(() => ({}));
        const payload = j.data || j;
        if (!r.ok) {
          const code = payload?.code || '';
          setErrCode(code);
          if (code === 'expired' || code === 'used') {
            setErrMsg('Questo link è scaduto o già utilizzato.');
          } else if (code === 'not_found') {
            setErrMsg('Link non valido.');
          } else {
            setErrMsg('Impossibile aprire il link.');
          }
          setState('error');
          return;
        }
        setLeadName(payload.name || '');
        setEmail(payload.email_from || '');
        setPhone(payload.phone || '');
        setState('ready');
      } catch {
        setErrMsg('Errore di connessione.');
        setState('error');
      }
    })();
  }, [id, token]);

  async function save() {
    if (!id || !token) return;
    setState('saving');
    setErrMsg(null);
    try {
      const r = await fetch(`/api/lead-public/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Lead-Token': token,
        },
        body: JSON.stringify({ email, phone }),
      });
      const j = await r.json().catch(() => ({}));
      const payload = j.data || j;
      if (!r.ok) {
        const code = payload?.code || '';
        if (code === 'expired' || code === 'used') {
          setErrMsg('Questo link è scaduto o già utilizzato.');
        } else if (code === 'not_found') {
          setErrMsg('Link non valido.');
        } else {
          setErrMsg(payload?.error || 'Errore salvataggio.');
        }
        setErrCode(code);
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setErrMsg('Errore di connessione.');
      setState('error');
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f8fafc] to-white">
        <Loader2 size={32} className="animate-spin text-[#1a2744]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white">
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
            V6 Impresa · Conferma dati
          </div>
          <h1 className="text-3xl font-bold text-[#1a2744] mb-2">
            {state === 'done' ? 'Grazie!' : 'Conferma i tuoi dati'}
          </h1>
          {state !== 'done' && state !== 'error' && leadName && (
            <p className="text-sm text-gray-500">Ciao {leadName}</p>
          )}
        </div>

        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">
              {errCode === 'expired' || errCode === 'used'
                ? 'Link scaduto o già usato'
                : 'Link non valido'}
            </h2>
            <p className="text-gray-600 text-sm">{errMsg}</p>
          </div>
        )}

        {state === 'done' && (
          <div className="bg-white rounded-2xl border border-emerald-100 p-8 text-center">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-emerald-700 mb-2">
              Dati confermati
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Grazie, i tuoi dati sono aggiornati.
            </p>
            <a
              href="https://v6impresa.it"
              className="inline-block px-5 py-2.5 bg-[#1a2744] text-white rounded-xl font-semibold hover:bg-[#0f3460]"
            >
              Vai a v6impresa.it
            </a>
          </div>
        )}

        {(state === 'ready' || state === 'saving') && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                <Mail size={14} className="inline mr-1" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === 'saving'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1a2744] outline-none"
                placeholder="tua@email.it"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                <Phone size={14} className="inline mr-1" /> Telefono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={state === 'saving'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1a2744] outline-none"
                placeholder="+39 ..."
              />
            </div>
            {errMsg && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                {errMsg}
              </div>
            )}
            <button
              onClick={save}
              disabled={state === 'saving' || !email.trim()}
              className="w-full px-5 py-3 bg-[#1a2744] text-white rounded-xl font-semibold hover:bg-[#0f3460] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {state === 'saving' && <Loader2 size={16} className="animate-spin" />}
              {state === 'saving' ? 'Salvataggio…' : 'Conferma dati'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Puoi modificare solo email e telefono. Per altri cambiamenti
              scrivi a info@v6impresa.it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
