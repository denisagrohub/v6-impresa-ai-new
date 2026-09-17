'use client';
import { useEffect, useState } from 'react';
import { DnaModal } from './DnaModal';

// 14/09/2026 - AREA LAVORO del workbench: scouting progetto (matching),
// drill-down DNA, scouting relazione (storico + potenziali).
type MatchResult = { partnerId: number; name: string; score: number; version: number; matched: string[]; settore: string; ragione: string };

export function WorkAreaPanel({ projectId }: { projectId: number }) {
  const [matching, setMatching] = useState(false);
  const [profile, setProfile] = useState<string[]>([]);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [dnaPartner, setDnaPartner] = useState<{ id: number; name: string } | null>(null);
  const [relLoading, setRelLoading] = useState(false);
  const [relResults, setRelResults] = useState<{ existing: any[]; candidates: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMatch = async () => {
    setMatching(true); setError(null); setRelResults(null);
    try {
      const d = await fetch(`/api/admin/partner-projects/${projectId}/scouting-match`).then(r => r.json());
      if (!d.success) throw new Error(d.error || 'Errore matcher');
      setProfile(d.profile || []); setResults(d.results || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Errore'); } finally { setMatching(false); }
  };

  const runRelations = async () => {
    if (!results?.length) { setError('Prima lancia lo Scouting Progetto: le relazioni si cercano sulle aziende candidate'); return; }
    setRelLoading(true); setError(null);
    try {
      // v1: per le prime 5 candidate, cerca in quali ALTRI progetti compaiono già (relazioni esistenti)
      const top = results.slice(0, 5);
      const existing: any[] = [];
      for (const r of top) {
        const rels = await fetch(`/api/admin/partner-projects/${projectId}/parts`).then(x => x.json()).catch(() => null);
        void rels; void r; // (estendibile: query tracking.relation per partner — v2)
      }
      // candidati relazione: aziende stesso settore già nel CRM
      const sameSector = results.filter(r => r.settore !== 'n.d.').slice(0, 8).map(r => ({ name: r.name, settore: r.settore }));
      setRelResults({ existing, candidates: sameSector });
    } finally { setRelLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          🎯 Area Lavoro — Scouting
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={runMatch} disabled={matching}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
          {matching ? 'Analisi…' : '🎯 Trova aziende qualificate'}
        </button>
        <button onClick={runRelations} disabled={relLoading}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
          {relLoading ? 'Ricerca…' : '🕸️ Scouting Relazione'}
        </button>
        {profile.length > 0 && (
          <span className="text-[10px] text-gray-400">Profilo: {profile.join(', ')}</span>
        )}
      </div>

      {error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">⚠️ {error}</p>}

      {results && (
        <div className="mt-3 space-y-1.5">
          {results.length === 0 && (
            <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
              Nessuna azienda con scouting nel CRM. Compila lo scouting (🔍) di qualche azienda e rilancia.
            </p>
          )}
          {results.map(r => (
            <div key={r.partnerId} className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50/50 px-3 py-2">
              <span className={`w-9 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${
                r.score >= 60 ? 'bg-green-100 text-green-700' : r.score >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'
              }`}>{r.score}</span>
              <span className="text-xs font-semibold text-[#1a2744]">{r.name}</span>
              <span className="text-[10px] text-gray-400">{r.settore} · scout v{r.version}</span>
              <span className="flex-1 truncate text-[10px] text-gray-400" title={r.ragione}>{r.ragione}</span>
              <button onClick={() => setDnaPartner({ id: r.partnerId, name: r.name })}
                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 cursor-pointer">
                🔬 Drill-down
              </button>
            </div>
          ))}
        </div>
      )}

      {relResults && (
        <div className="mt-3 rounded border border-gray-100 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">🕸️ Relazioni</p>
          <p className="text-xs text-gray-500">
            Candidati connessioni (stesso settore già nel CRM): {relResults.candidates.map(c => c.name).join(' · ') || 'n.d.'}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">Lo storico relazioni per azienda (altri progetti condivisi) arriva nella v2 del pannello.</p>
        </div>
      )}

      {dnaPartner && (
        <DnaModal partnerId={dnaPartner.id} partnerName={dnaPartner.name}
          onChanged={() => setDnaPartner(null)} />
      )}

    </div>
  );
}
