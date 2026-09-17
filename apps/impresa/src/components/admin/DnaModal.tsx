'use client';
import { useEffect, useState } from 'react';

// 14/09/2026 - Drill-down DNA (schema "Company DNA" v2, standard Statkraft):
// ogni dato porta status + confidence + source_type (S1-S4); le inferenze
// pericolose sono bloccate per costruzione (iscrizione GME ≠ attività commerciale).
// Doppio flusso: prompt copiabile verso AI esterne + import della risposta JSON.
const PROMPT = (nome: string) =>
`Ricerca di intelligence aziendale STRUTTURATA su "${nome}".
Prodoci SOLO un oggetto JSON valido conforme a questo schema (nessun testo fuori dal JSON):

{
  "company": { "name": "", "legal_name": "", "country": "", "industry": "", "business_model": "", "status": "CURRENT/VERIFIED|UNVERIFIED", "confidence": "HIGH|MEDIUM|LOW" },
  "group": { "name": "", "employees": { "value": 0, "source_type": "S1|S2|S3|S4" }, "countries": 0 },
  "business": { "core": ["..."] },
  "markets": { "relevant_market": { "status": "ACTIVE|UNKNOWN", "confidence": "HIGH|MEDIUM|LOW" } },
  "tee": { "operator_registration": { "entity": "", "status": "", "source_type": "" },
           "commercial_activity_italy": { "status": "", "confidence": "", "source_type": "", "source": "" },
           "trading_activity": { "status": "", "confidence": "" } },
  "people": { "contatto_chiave": { "name": "", "relationship": "DIRECT_CONTACT|PROSPECT|UNKNOWN", "source_type": "", "confidence": "" } },
  "signals": [ { "signal": "", "status": "VERIFIED|USER_PROVIDED|UNVERIFIED" } ],
  "opportunities": { "progetto": { "potential": "HIGH|MEDIUM|LOW", "status": "UNQUALIFIED|QUALIFIED", "rationale": "" } },
  "v6_relationship": { "relationship_status": "PROSPECT|CLIENT|PARTNER|NONE", "priority": "HIGH|MEDIUM|LOW" },
  "sources": [ { "source_type": "S1|S2|S3|S4", "description": "", "reliability": "HIGH|MEDIUM|LOW" } ],
  "confidence": { "overall": "HIGH|MEDIUM|LOW" },
  "last_research_date": "YYYY-MM-DD"
}

REGOLE:
- S1=sito/bilanci ufficiali, S2=registri ufficiali, S3=stampa qualificata, S4=contatto diretto
- NON trasformare una registrazione formale in prova di attività commerciale: usa status diversi
- Se un dato non è verificabile scrivi status "NOT_VERIFIED" e confidence "LOW"
- Ogni dato deve avere fonte e data quando possibile. Nessun testo fuori dal JSON.`;

export function DnaModal({ partnerId, partnerName, onChanged }: {
  partnerId: number; partnerName: string; onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dna, setDna] = useState<any>(null);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const openModal = async () => {
    setError(null); setOpen(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`);
      const d = await res.json();
      if (d.success) setDna(d.scouting?.dna || null);
    } catch { /* parte vuota */ }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(PROMPT(partnerName));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const importJson = () => {
    setError(null);
    try {
      const parsed = JSON.parse(pasted);
      if (typeof parsed !== 'object' || !parsed.company) throw new Error('JSON senza "company" — non sembra un DNA valido');
      setDna(parsed); setPasted('');
    } catch (e) { setError(e instanceof Error ? e.message : 'JSON non valido'); }
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      // merge: legge lo scouting esistente, aggiunge/aggiorna solo il ramo dna
      const cur = await fetch(`/api/admin/partners/${partnerId}`).then(r => r.json());
      const scouting = cur.scouting || { schemaVersion: 1, version: 0 };
      const next = { ...scouting, dna, dnaSavedAt: new Date().toISOString() };
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scouting: next }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`);
      onChanged?.(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Errore'); } finally { setSaving(false); }
  };

  return (
    <>
      <button onClick={openModal}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
          dna ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`} title={dna ? 'DNA presente — apri drill-down' : 'Drill-down: research profonda (schema Company DNA)'}>
        🧬 DNA {dna ? '✓' : ''}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-semibold">Company DNA: {partnerName}</h3>
            <p className="mb-3 text-xs text-gray-400">Schema v2 — ogni dato con fonte (S1-S4), status e confidence. Le inferenze non verificate restano NOT_VERIFIED.</p>

            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={copyPrompt}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                {copied ? '✅ Prompt copiato!' : '📋 Prompt per AI esterna'}
              </button>
            </div>

            {!dna && (
              <div className="mb-3">
                <textarea value={pasted} onChange={e => setPasted(e.target.value)} rows={5}
                  placeholder="Incolla qui la risposta JSON dell'AI esterna…"
                  className="w-full rounded border border-gray-300 p-2 font-mono text-[11px]" />
                <button onClick={importJson} disabled={!pasted.trim()}
                  className="mt-1.5 rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">
                  ⬇︎ Importa e valida JSON
                </button>
              </div>
            )}

            {error && <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600">⚠️ {error}</p>}

            {dna && (
              <div className="mb-3 space-y-2">
                <div className="rounded bg-indigo-50 p-3 text-xs">
                  <p className="font-semibold text-indigo-800">{dna.company?.name} <span className="ml-1 font-normal text-indigo-500">({dna.company?.country}, {dna.company?.industry})</span></p>
                  <p className="mt-0.5 text-indigo-600">{dna.company?.business_model}</p>
                  <p className="mt-1">Confidence complessiva: <b>{dna.confidence?.overall || 'n.d.'}</b> · Ultima ricerca: {dna.last_research_date || 'n.d.'}</p>
                </div>
                {Array.isArray(dna.signals) && dna.signals.length > 0 && (
                  <div className="rounded border border-gray-200 p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Signals</p>
                    <ul className="list-inside list-disc space-y-0.5 text-xs text-gray-600">
                      {dna.signals.map((s: any, i: number) => (
                        <li key={i}>{s.signal} <span className={`ml-1 rounded px-1 text-[10px] ${s.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : s.status === 'USER_PROVIDED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {dna.opportunities && (
                  <div className="rounded border border-gray-200 p-3 text-xs">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Opportunità</p>
                    <p className="text-gray-600">{JSON.stringify(dna.opportunities, null, 1).slice(0, 400)}</p>
                  </div>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500">JSON completo</summary>
                  <pre className="mt-1 max-h-56 overflow-auto rounded bg-gray-50 p-2 text-[10px]">{JSON.stringify(dna, null, 2)}</pre>
                </details>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">Chiudi</button>
              {dna && (
                <button onClick={save} disabled={saving}
                  className="rounded bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50 cursor-pointer">
                  {saving ? 'Salvataggio…' : 'Salva DNA in anagrafica'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
