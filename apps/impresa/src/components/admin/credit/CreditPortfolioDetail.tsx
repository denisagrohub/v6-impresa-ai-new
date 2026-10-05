'use client';

// 05/10/2026 (C-crediti-1c): dettaglio portfolio + edit righe.

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, ArrowLeft, RotateCw } from 'lucide-react';
import Link from 'next/link';

type Line = {
  id: number;
  codice: string;
  descrizione: string;
  tipologia: string;
  anno: number;
  importo: number;
  quantita: number;
  prezzo_unitario: number;
  codice_progetto: string;
  categoria_cedibilita: string;
  selezionato: boolean;
};

type Portfolio = {
  id: number;
  name: string;
  cedente_id: number | null;
  cedente_name: string | null;
  mandatario_name: string | null;
  relation_id: number | null;
  relation_name: string | null;
  certificate_type: string;
  state: string;
  data_estratto: string | null;
  utenza_lavoro: string;
  cf_commercialista: string;
  total_amount: number;
  total_lines: number;
  file_pdf_name: string;
  notes: string;
  lines?: Line[];
};

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Bozza',        cls: 'bg-gray-100 text-gray-700' },
  parsed:   { label: 'In revisione', cls: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Verificato',   cls: 'bg-emerald-100 text-emerald-800' },
  archived: { label: 'Archiviato',   cls: 'bg-slate-200 text-slate-700' },
};

const TIPOLOGIA_LABELS: Record<string, string> = {
  bonus_facciate: 'Bonus facciate',
  ecobonus: 'Ecobonus',
  sismabonus: 'Sismabonus',
  superbonus: 'Superbonus',
  intermediari: 'Intermediari',
  tee_fer: 'TEE FER',
  tee_cogenerazione: 'TEE Cogenerazione',
  tee_efficienza: 'TEE Efficienza',
  altro: 'Altro',
};

const CEDIBILITA_LABELS: Record<string, string> = {
  chiunque_3volte: 'Chiunque + 3 volte qualificati',
  '3volte_qualificati': '3 volte qualificati',
  '2volte_qualificati': '2 volte qualificati',
  '1volta_qualificati': '1 volta qualificati',
  piu_volte_chiunque: 'Più volte chiunque',
  '1volta_chiunque': '1 volta chiunque',
  '1volta_intermediari': '1 volta intermediari',
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

export default function CreditPortfolioDetail({ portfolioId }: { portfolioId: string }) {
  const [p, setP] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/admin/credit-portfolios/${portfolioId}`, { headers: authHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setP(j);
      setNotesDraft(j.notes || '');
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [portfolioId]);

  async function action(name: 'reprocess' | 'confirm') {
    setBusy(true); setNotice(null); setError(null);
    try {
      const r = await fetch(`/api/admin/credit-portfolios/${portfolioId}/${name}`, {
        method: 'POST', headers: authHeaders(),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setP(j.portfolio);
      setNotesDraft(j.portfolio?.notes || '');
      setNotice(name === 'reprocess' ? 'Riprocessato.' : 'Confermato.');
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setBusy(false);
    }
  }

  async function updateLine(lineId: number, vals: Partial<Line>) {
    const r = await fetch(`/api/admin/credit-portfolios/${portfolioId}/line/${lineId}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || `HTTP ${r.status}`); return; }
    // aggiorna la riga localmente + totale
    setP(prev => {
      if (!prev || !prev.lines) return prev;
      const newLines = prev.lines.map(l => l.id === lineId ? { ...l, ...j.line } : l);
      const newTotal = newLines.reduce((s, l) => s + (l.importo || 0), 0);
      return { ...prev, lines: newLines, total_amount: newTotal };
    });
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento…
    </div>
  );

  if (error && !p) return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/admin/credit-portfolios" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna alla lista
      </Link>
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>{error}</div>
      </div>
    </div>
  );

  if (!p) return null;

  const st = STATE_LABELS[p.state] || { label: p.state, cls: 'bg-slate-100 text-slate-700' };
  const isDraft = p.state === 'draft';
  const isParsed = p.state === 'parsed';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/admin/credit-portfolios" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna alla lista
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {p.cedente_name || <span className="text-amber-700 italic">Da associare</span>}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{p.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 text-xs rounded ${st.cls}`}>{st.label}</span>
            <span className="text-xs text-slate-500">#{p.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <button onClick={() => action('reprocess')} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              <RotateCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Riprocessa
            </button>
          )}
          {(isDraft || isParsed) && (
            <button onClick={() => action('confirm')} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> Conferma
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm">{notice}</div>
      )}
      {error && p && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{error}</div>
      )}

      {isDraft && !p.cedente_id && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-sm">
          Il cedente <strong>{p.name.split(' — ')[0]}</strong> non è ancora un contatto in Odoo.
          Creane uno in <Link href="/admin/partner-projects" className="underline">Progetti Partner</Link>,
          poi clicca <strong>Riprocessa</strong> per riprovare il match.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-slate-200 rounded-lg p-4 bg-white">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-3">Anagrafica</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Mandatario</dt><dd className="text-slate-900">{p.mandatario_name || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Progetto</dt>
              <dd className="text-slate-900">
                {p.relation_id ? <Link href={`/admin/partner-projects/${p.relation_id}`} className="underline">{p.relation_name}</Link> : '-'}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-500">Data estratto</dt><dd className="text-slate-900">{p.data_estratto || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Utenza lavoro</dt><dd className="text-slate-900 font-mono text-xs">{p.utenza_lavoro || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">CF commercialista</dt><dd className="text-slate-900 font-mono text-xs">{p.cf_commercialista || '-'}</dd></div>
          </dl>
        </div>
        <div className="border border-slate-200 rounded-lg p-4 bg-white">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-3">Totali</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Righe</dt><dd className="text-slate-900 tabular-nums">{p.total_lines}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Importo totale</dt><dd className="text-slate-900 font-semibold tabular-nums">{eur(p.total_amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">PDF</dt><dd className="text-slate-900 truncate text-xs max-w-xs" title={p.file_pdf_name}>{p.file_pdf_name || '-'}</dd></div>
          </dl>
        </div>
      </div>

      {p.lines && p.lines.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-6">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-medium text-slate-700">Righe ({p.lines.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Codice</th>
                <th className="text-left px-3 py-2">Tipologia</th>
                <th className="text-right px-3 py-2">Anno</th>
                <th className="text-right px-3 py-2">Importo</th>
                <th className="text-left px-3 py-2">Cedibilità</th>
                <th className="text-center px-3 py-2">Sel.</th>
              </tr>
            </thead>
            <tbody>
              {p.lines.map(l => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <input
                      type="text"
                      defaultValue={l.codice}
                      onBlur={(e) => e.target.value !== l.codice && updateLine(l.id, { codice: e.target.value })}
                      className="w-20 border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">{TIPOLOGIA_LABELS[l.tipologia] || l.tipologia || '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <input
                      type="number"
                      defaultValue={l.anno}
                      onBlur={(e) => Number(e.target.value) !== l.anno && updateLine(l.id, { anno: Number(e.target.value) })}
                      className="w-16 border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={l.importo}
                      onBlur={(e) => Number(e.target.value) !== l.importo && updateLine(l.id, { importo: Number(e.target.value) })}
                      className="w-28 border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-right font-medium"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{CEDIBILITA_LABELS[l.categoria_cedibilita] || l.categoria_cedibilita || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      defaultChecked={l.selezionato}
                      onChange={(e) => updateLine(l.id, { selezionato: e.target.checked })}
                      className="cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-medium">
              <tr className="border-t border-slate-200">
                <td colSpan={3} className="px-3 py-2 text-right text-slate-600">Totale:</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">{eur(p.total_amount)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-2">Note</h3>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:border-blue-400 outline-none"
          placeholder="Note interne…"
        />
      </div>
    </div>
  );
}
