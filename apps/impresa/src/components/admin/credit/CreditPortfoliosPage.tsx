'use client';

// 05/10/2026 (C-crediti-1c): /admin/credit-portfolios — lista portfolio
// crediti fiscali (cassetti AdE). Click su riga → dettaglio.
// Filtro per state. Ricarica manuale.

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, FolderOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

type Portfolio = {
  id: number;
  name: string;
  cedente_id: number | null;
  cedente_name: string | null;
  state: string;
  data_estratto: string | null;
  utenza_lavoro: string;
  cf_commercialista: string;
  total_amount: number;
  total_lines: number;
  file_pdf_name: string;
  certificate_type: string;
  relation_id: number | null;
  relation_name: string | null;
  create_date: string | null;
};

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Bozza',           cls: 'bg-gray-100 text-gray-700' },
  parsed:   { label: 'In revisione',    cls: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Verificato',      cls: 'bg-emerald-100 text-emerald-800' },
  archived: { label: 'Archiviato',      cls: 'bg-slate-200 text-slate-700' },
};

const TYPE_LABELS: Record<string, string> = {
  credit_tax: 'Credito fiscale',
  tee: 'TEE',
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

function eur(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function CreditPortfoliosPage() {
  const [items, setItems] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('');

  async function load() {
    setLoading(true); setError(null);
    try {
      const qs = stateFilter ? `?state=${stateFilter}` : '';
      const r = await fetch(`/api/admin/credit-portfolios${qs}`, { headers: authHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setItems(j.portfolios || []);
    } catch (e: any) {
      setError(e.message || 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [stateFilter]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Portafogli crediti</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cassetti fiscali AdE ricevuti via email sull&apos;alias <code className="text-xs bg-slate-100 px-1 rounded">acquisizione-certificati</code>.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-600">Filtro:</span>
        {[
          { v: '',           l: 'Tutti' },
          { v: 'draft',      l: 'Bozza' },
          { v: 'parsed',     l: 'In revisione' },
          { v: 'reviewed',   l: 'Verificati' },
          { v: 'archived',   l: 'Archiviati' },
        ].map(f => (
          <button key={f.v} onClick={() => setStateFilter(f.v)}
            className={`px-3 py-1 text-xs rounded-full border ${
              stateFilter === f.v
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}>
            {f.l}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{items.length} risultati</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <FolderOpen className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-sm">Nessun portafoglio.</p>
          <p className="text-xs mt-1">Manda un cassetto AdE a <code>acquisizione-certificati@v6impresa.it</code> per crearne uno.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2">Cedente</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">Stato</th>
                <th className="text-right px-4 py-2">Righe</th>
                <th className="text-right px-4 py-2">Totale</th>
                <th className="text-left px-4 py-2">Creato</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => {
                const st = STATE_LABELS[p.state] || { label: p.state, cls: 'bg-slate-100 text-slate-700' };
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/credit-portfolios/${p.id}`} className="block">
                        <div className="font-medium text-slate-900">
                          {p.cedente_name || <span className="text-amber-700 italic">Da associare</span>}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-md">{p.name}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {TYPE_LABELS[p.certificate_type] || p.certificate_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{p.total_lines}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900 font-medium">{eur(p.total_amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.create_date ? new Date(p.create_date).toLocaleDateString('it-IT') : '-'}
                    </td>
                    <td className="px-2 text-slate-400">
                      <Link href={`/admin/credit-portfolios/${p.id}`}>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
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
