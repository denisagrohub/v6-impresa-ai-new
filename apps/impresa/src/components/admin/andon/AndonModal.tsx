'use client';

// 04/10/2026 (C5-h): modal Andon.
// Campi: cosa + dettagli + gravità + progetto (obbligatorio) +
// source_url automatico (window.location).

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

type Project = { id: number; name: string };

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function AndonModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'near_miss'|'lieve'|'grave'>('lieve');
  const [relationId, setRelationId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/partner-projects', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.projects || d.data || []);
        setProjects(arr.map((p: any) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  async function submit() {
    if (!title.trim()) { setError('Cosa hai visto? È obbligatorio.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/andon-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity,
          relation_id: relationId,
          source_url: window.location.pathname + window.location.search,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 200) || 'Invio fallito');
      }
      const data = await res.json();
      setResult({ id: data.id });
      setTimeout(() => onClose(), 3000);
    } catch (e: any) {
      setError(e?.message || 'Errore invio');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
          <div className="text-3xl mb-3 text-emerald-600">✓</div>
          <h3 className="text-lg font-semibold mb-2 text-[#0F1E3C]">
            Segnalazione #{result.id} ricevuta
          </h3>
          <p className="text-sm text-gray-600">
            Il sistema Kaizen la processerà a breve.
            Riceverai un&apos;email di conferma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-semibold mb-1 text-[#0F1E3C]">
          Segnala un problema
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Cos&apos;hai visto? Il sistema lo trasformerà in una proposta
          di miglioramento.
        </p>

        <label className="block text-sm font-medium mb-1 text-gray-700">
          Cosa hai visto?
        </label>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Es. Composer non accetta email libere"
          maxLength={120}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:border-[#0F1E3C]"
        />

        <label className="block text-sm font-medium mb-1 text-gray-700">
          Dettagli (opzionale)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:border-[#0F1E3C]"
        />

        <label className="block text-sm font-medium mb-1 text-gray-700">
          Gravità
        </label>
        <div className="flex gap-2 mb-3">
          {([
            { v: 'near_miss', l: '🟢 Lieve' },
            { v: 'lieve', l: '🟡 Medio' },
            { v: 'grave', l: '🔴 Grave' },
          ] as const).map(({ v, l }) => (
            <button
              key={v}
              type="button"
              onClick={() => setSeverity(v)}
              className={`flex-1 py-2 rounded-lg border text-xs transition-colors ${
                severity === v
                  ? 'bg-[#0F1E3C] text-white border-[#0F1E3C]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium mb-1 text-gray-700">
          Progetto (opzionale)
        </label>
        <select
          value={relationId ?? ''}
          onChange={(e) => setRelationId(e.target.value ? Number(e.target.value) : null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:border-[#0F1E3C]"
        >
          <option value="">Nessun progetto specifico</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {error && (
          <div className="text-sm text-red-600 mb-3 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Invio...' : 'Segnala'}
          </button>
        </div>
      </div>
    </div>
  );
}
