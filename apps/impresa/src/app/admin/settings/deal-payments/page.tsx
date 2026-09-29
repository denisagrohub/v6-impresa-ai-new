// ═══════════════════════════════════════════════════════════════════
// /admin/settings/deal-payments — configurazione doppia firma bonifici.
// Soglia oltre la quale serve la 2ª firma + lista approvers.
// Persistenza: ir.config_parameter Odoo (erpv6_deal.payment_*).
// Aggiunto il 29/09/2026 (C5.1c).
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save, Trash2, Plus } from 'lucide-react';
import { getAuthToken } from '@/components/deal/auth';

type Approver = { id: number; name: string; email: string };

export default function DealPaymentsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle'|'success'|'error'; msg: string }>({ type: 'idle', msg: '' });
  const [threshold, setThreshold] = useState<number>(10000);
  const [approvers, setApprovers] = useState<Approver[]>([]);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Approver[]>([]);
  const [searching, setSearching] = useState(false);

  const authHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    return token ? { Authorization: `JWT ${token}` } : {};
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/settings/deal-payments', { headers: authHeaders() });
        const d = await r.json();
        if (!d.success) { setStatus({ type: 'error', msg: d.error || 'Errore' }); return; }
        setThreshold(Number(d.threshold) || 0);
        setApprovers(d.approvers || []);
      } catch (e: any) {
        setStatus({ type: 'error', msg: e.message });
      } finally { setLoading(false); }
    })();
  }, []);

  const searchUsers = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) {
        // Escludi chi è già approver
        const ids = new Set(approvers.map(a => a.id));
        setSearchResults((d.users || []).filter((u: Approver) => !ids.has(u.id)));
      }
    } catch {}
    setSearching(false);
  };

  const addApprover = (u: Approver) => {
    setApprovers(prev => [...prev, u]);
    setSearchQ('');
    setSearchResults([]);
  };

  const removeApprover = (id: number) => {
    setApprovers(prev => prev.filter(a => a.id !== id));
  };

  const save = async () => {
    setSaving(true);
    setStatus({ type: 'idle', msg: '' });
    try {
      const r = await fetch('/api/admin/settings/deal-payments', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold, approvers: approvers.map(a => a.id) }),
      });
      const d = await r.json();
      if (!d.success) {
        setStatus({ type: 'error', msg: d.error || 'Errore' });
      } else {
        setStatus({ type: 'success', msg: 'Salvato' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-gray-500">
      <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/admin/settings" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Impostazioni
      </Link>

      <h1 className="text-xl font-bold mb-1">Bonifici deal — doppia firma</h1>
      <p className="text-sm text-gray-500 mb-6">
        Sopra la soglia, un bonifico richiede l&apos;approvazione di 2 admin diversi (della lista sotto).
        Sotto soglia basta 1 firma.
      </p>

      {status.type !== 'idle' && (
        <div className={`mb-4 p-3 rounded-md text-sm border ${
          status.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {status.msg}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <label className="block text-sm font-semibold mb-1">Soglia (€)</label>
        <p className="text-xs text-gray-500 mb-2">
          Sopra questo importo serve la 2ª firma. Sotto, 1 firma sola.
        </p>
        <input
          type="number"
          min={0}
          step={100}
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value) || 0)}
          className="w-48 px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:border-blue-500 focus:outline-none"
        />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <label className="block text-sm font-semibold mb-1">Approvers (2ª firma)</label>
        <p className="text-xs text-gray-500 mb-3">
          Solo questi utenti possono firmare per secondi. La 2ª firma deve essere di un utente diverso dal 1°.
        </p>

        {approvers.length === 0 ? (
          <p className="text-sm text-gray-400 italic mb-3">Nessun approver configurato → doppia firma disattivata.</p>
        ) : (
          <ul className="space-y-1 mb-3">
            {approvers.map(a => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded text-sm">
                <span className="flex-1">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-gray-500 ml-2 text-xs">{a.email}</span>
                </span>
                <button
                  onClick={() => removeApprover(a.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Rimuovi"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="Cerca per nome o email…"
            value={searchQ}
            onChange={e => searchUsers(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
          />
          {searching && <Loader2 className="absolute right-3 top-2 w-4 h-4 animate-spin text-gray-400" />}
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-60 overflow-y-auto">
              {searchResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => addApprover(u)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Plus size={12} className="text-gray-400" />
                  <span className="font-medium">{u.name}</span>
                  <span className="text-gray-500 text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0f172a] text-white text-sm font-semibold hover:bg-[#1e293b] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </div>
  );
}
