// ═══════════════════════════════════════════════════════════════════
// /admin/bandi — lista bandi di finanziamento attivi.
//
// Step 4 (permessi): accessibile a chief_bandi + admin.
// Il gate server-side è nel proxy /api/admin/bandi; qui c'è il guard
// client-side per coerenza UX (redirect se l'utente non ha i permessi).
//
// Fonte: GET /api/admin/bandi → gateway /api/v1/bandi/active.
// Ordinati per scadenza (i più urgenti in alto).
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, Search, Calendar, Building2, Euro, Target, RefreshCw,
} from 'lucide-react';

type Bando = {
  id: number;
  name: string;
  code: string;
  ente: string;
  importo_max: number;
  scadenza_domanda: string | null;
  tipo_agevolazione: string;
  match_count: number;
  best_score: number;
};

const fmtEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
};

const daysTo = (iso: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso).getTime() - Date.now();
  return Math.ceil(d / (1000 * 60 * 60 * 24));
};

export default function BandiPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bandi, setBandi] = useState<Bando[]>([]);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');

  useEffect(() => {
    // 1. Gate client-side: leggo roles da pi_session
    try {
      const raw = localStorage.getItem('pi_session');
      const session = raw ? JSON.parse(raw) : null;
      const roles: string[] = session?.roles || (session?.role ? [session.role] : []);
      if (!roles.includes('admin') && !roles.includes('chief_bandi')) {
        router.push('/admin/dashboard');
        return;
      }
    } catch {
      router.push('/login');
      return;
    }

    // 2. Fetch
    (async () => {
      try {
        const token = (() => {
          try {
            const raw = localStorage.getItem('pi_session');
            const s = raw ? JSON.parse(raw) : null;
            return s?.token;
          } catch { return null; }
        })();
        if (!token) { setLoadError('Sessione mancante'); setLoading(false); return; }

        const r = await fetch('/api/admin/bandi', {
          headers: { Authorization: `JWT ${token}` },
        });
        const d = await r.json();
        if (!r.ok) { setLoadError(d.error || 'Errore'); return; }
        // Gateway ritorna { success, data: [...] } oppure array diretto
        const list: Bando[] = d.data || d || [];
        setBandi(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = bandi.filter(b => {
    if (tipoFilter && b.tipo_agevolazione !== tipoFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (b.name + ' ' + b.ente + ' ' + b.code).toLowerCase().includes(q);
  });

  const tipi = Array.from(new Set(bandi.map(b => b.tipo_agevolazione).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2744]">Bandi di finanziamento</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Caricamento…' : `${filtered.length} bandi${tipoFilter ? ` (${tipoFilter})` : ''}${search ? ` per "${search}"` : ''}`}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Aggiorna
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per nome, ente, codice…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={tipoFilter}
          onChange={e => setTipoFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tutti i tipi</option>
          {tipi.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loadError && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="p-6 flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento bandi…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Target size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {bandi.length === 0 ? 'Nessun bando attivo al momento.' : 'Nessun bando corrisponde ai filtri.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5">Bando</th>
                <th className="px-4 py-2.5">Ente</th>
                <th className="px-4 py-2.5 text-right">Importo max</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Scadenza</th>
                <th className="px-4 py-2.5 text-center">Match</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const days = daysTo(b.scadenza_domanda);
                const urgent = days !== null && days >= 0 && days <= 30;
                const expired = days !== null && days < 0;
                return (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-sm text-[#0f172a]">{b.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{b.code}</div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 flex items-center gap-1">
                      <Building2 size={12} className="text-gray-400" />
                      {b.ente || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {b.importo_max ? fmtEur(b.importo_max) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {b.tipo_agevolazione || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        <span className={expired ? 'text-red-600 line-through' : urgent ? 'text-amber-700 font-semibold' : 'text-gray-700'}>
                          {fmtDate(b.scadenza_domanda)}
                        </span>
                      </div>
                      {days !== null && !expired && (
                        <div className={`text-[10px] ${urgent ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>
                          {days === 0 ? 'oggi' : `tra ${days}g`}
                        </div>
                      )}
                      {expired && <div className="text-[10px] text-red-500">scaduto</div>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {b.match_count > 0 ? (
                        <div>
                          <div className="text-sm font-semibold text-emerald-700">{b.match_count}</div>
                          {b.best_score > 0 && (
                            <div className="text-[10px] text-gray-400">
                              best {Math.round(b.best_score)}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
