'use client';

import { useState, useEffect } from 'react';
import { Bot, RefreshCw, Search, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Loader2, Sparkles } from 'lucide-react';

export type ScoutingPayload = {
  schemaVersion?: number;
  generated_at?: string;
  generated_by?: 'auto' | 'manual';
  project_name?: string;
  queries?: string[];
  sources_used?: string[];
  results?: {
    fetch_type: string;
    query: string;
    rationale?: string;
    kb_id?: number;
    error?: string;
  }[];
};

export function ProjectScoutingCard({
  relationId,
  payload,
  onOpenDetail,
  onRefreshed,
}: {
  relationId: number;
  payload: ScoutingPayload | null;
  onOpenDetail: () => void;
  onRefreshed?: (newPayload: ScoutingPayload | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rescouting, setRescouting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [local, setLocal] = useState<ScoutingPayload | null>(payload);

  useEffect(() => { setLocal(payload); }, [payload]);

  const hasScouting = !!(local && (local.queries?.length || local.results?.length));

  const handleRescout = async () => {
    setRescouting(true);
    setMsg('In corso… 30-120 sec');
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 120000);
      const r = await fetch(`/api/admin/partner-projects/${relationId}/scouting-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(t);
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Errore');

      // Ricarico dati con retry
      let found: ScoutingPayload | null = null;
      for (let i = 0; i < 8; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        try {
          const r2 = await fetch(`/api/admin/partner-projects/${relationId}`);
          const d2 = await r2.json();
          const sc = d2?.project?.relationScouting ?? null;
          if (sc && (sc.queries || sc.results)) { found = sc; break; }
        } catch { /* */ }
      }

      if (found) {
        setLocal(found);
        onRefreshed?.(found);
        setMsg('✅ Aggiornato');
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg('⚠️ Dati non pronti, ricarica la pagina');
      }
    } catch (e: any) {
      if (e.name === 'AbortError') setMsg('⚠️ Timeout 120 sec. Ricarica tra 30 sec.');
      else setMsg(`Errore: ${e.message}`);
    } finally {
      setRescouting(false);
    }
  };

  // Stati vuoto: nessuno scouting ancora
  if (!hasScouting) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-lg px-4 py-2.5 mb-3 mx-5 flex items-center gap-3">
        <Bot size={16} className="text-indigo-500 shrink-0" />
        <div className="flex-1 text-xs text-gray-600">
          <span className="font-semibold text-gray-700">Scouting automatico</span>
          <span className="ml-2 text-gray-500">Non ancora eseguito per questo progetto.</span>
        </div>
        {msg ? (
          <span className="text-[11px] text-indigo-700">{msg}</span>
        ) : null}
        <button
          onClick={handleRescout}
          disabled={rescouting}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {rescouting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {rescouting ? 'Scouto…' : 'Lancia scouting'}
        </button>
      </div>
    );
  }

  // Card con dati
  const okCount = local!.results?.filter((r) => !r.error).length ?? 0;
  const totalCount = local!.results?.length ?? 0;
  const generatedAt = local!.generated_at ? new Date(local!.generated_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="bg-gradient-to-r from-indigo-50/70 to-white border border-indigo-100 rounded-lg mb-3 mx-5 overflow-hidden">
      {/* Header riga */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Bot size={16} className="text-indigo-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs">
            <span className="font-semibold text-gray-700">Scouting automatico</span>
            {generatedAt && <span className="text-gray-400 ml-2">· {generatedAt}</span>}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-3">
            <span>{local!.queries?.length ?? 0} query</span>
            <span>·</span>
            <span>{local!.sources_used?.length ?? 0} fonti</span>
            <span>·</span>
            <span className={okCount > 0 ? 'text-emerald-700' : 'text-amber-700'}>
              {okCount}/{totalCount} risultati
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-600 hover:bg-white"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? 'Chiudi' : 'Espandi'}
          </button>
          <button
            onClick={onOpenDetail}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-200 bg-white text-indigo-700 text-[11px] font-medium hover:bg-indigo-50"
          >
            <ExternalLink size={11} /> Dettaglio
          </button>
          <button
            onClick={handleRescout}
            disabled={rescouting}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {rescouting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {rescouting ? '…' : 'Riscouta'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="px-4 pb-1.5 text-[11px] text-indigo-700">{msg}</div>
      )}

      {/* Contenuto espanso */}
      {expanded && (
        <div className="border-t border-indigo-100 px-4 py-3 space-y-3 bg-white/50">
          {/* Query */}
          {local!.queries && local!.queries.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Query generate</div>
              <div className="space-y-1">
                {local!.queries.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <Search size={11} className="text-indigo-500 shrink-0 mt-0.5" />
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fonti + risultati */}
          {local!.results && local!.results.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Risultati</div>
              <div className="space-y-1">
                {local!.results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {r.error ? (
                      <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-700">{r.fetch_type}</span>
                      {r.rationale && <span className="text-gray-500 ml-2">{r.rationale.slice(0, 100)}</span>}
                      {r.error && <span className="text-amber-700 ml-2 text-[10px]">{r.error.slice(0, 100)}</span>}
                    </div>
                    {r.kb_id && (
                      <span className="text-[10px] text-emerald-700 font-mono">KB #{r.kb_id}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
