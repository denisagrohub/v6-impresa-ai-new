// ═══════════════════════════════════════════════════════════════════
// DealAccessLog — tab Audit: chi ha aperto/modificato il deal.
// Fonte: erpv6.api.log filtrato per endpoint del deal. C5.4.
// Mostra: utente, IP, endpoint, metodo, status, quando.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { getAuthToken } from '@/components/deal/auth';

type LogRow = {
  id: number;
  endpoint: string;
  method: string;
  status_code: number;
  user_id: number | null;
  user_name: string;
  ip_address: string;
  user_agent: string;
  response_time_ms: number;
  create_date: string | null;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return '—'; }
};

const shortEndpoint = (ep: string) =>
  ep.replace('/api/v1/admin/deals/', '');

export function DealAccessLog({ dealId }: { dealId: number }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) { setError('Sessione mancante'); setLoading(false); return; }
      try {
        const r = await fetch(`/api/admin/deals/${dealId}/access-log`, {
          headers: { Authorization: `JWT ${token}` },
        });
        const d = await r.json();
        if (!d.success) { setError(d.error || 'Errore'); }
        else { setLogs(d.logs || []); }
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [dealId]);

  if (loading) return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center gap-2 text-gray-500 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Caricamento log accessi…
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
      {error}
    </div>
  );

  if (logs.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500 italic">
      Nessun accesso registrato per questo deal.
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Shield size={14} className="text-indigo-600" />
        <span className="font-semibold text-sm">Audit accessi (ultimi 100)</span>
        <span className="text-xs text-gray-400 ml-auto">{logs.length} eventi</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Quando</th>
              <th className="px-3 py-2 text-left">Utente</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">Azione</th>
              <th className="px-3 py-2 text-left">Metodo</th>
              <th className="px-3 py-2 text-right">Status</th>
              <th className="px-3 py-2 text-right">ms</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 font-mono text-gray-700">{fmtDate(l.create_date)}</td>
                <td className="px-3 py-1.5">{l.user_name}</td>
                <td className="px-3 py-1.5 font-mono text-gray-500">{l.ip_address || '—'}</td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-gray-600">
                  {l.endpoint.endsWith(String(dealId)) ? 'dettaglio' : shortEndpoint(l.endpoint)}
                </td>
                <td className="px-3 py-1.5 text-gray-600">{l.method}</td>
                <td className="px-3 py-1.5 text-right font-mono">
                  <span className={l.status_code >= 400 ? 'text-red-600' : 'text-emerald-600'}>
                    {l.status_code}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-gray-500">
                  {l.response_time_ms}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
