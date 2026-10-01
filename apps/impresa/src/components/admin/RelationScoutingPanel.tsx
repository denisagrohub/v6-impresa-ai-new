"use client";
import { useState } from "react";
import { X, Loader2, Save, Target, Bot, Search, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";

export interface RelationScoutingData {
  schemaVersion?: number;
  version?: number;
  savedAt?: string;
  data?: Record<string, any>;
  history?: any[];
  // 01/10/2026 (F3.A): formato auto-generato dal planner AI
  generated_at?: string;
  generated_by?: 'auto' | 'manual';
  project_name?: string;
  charter_hash?: number;
  queries?: string[];
  sources_used?: string[];
  results?: {
    fetch_type: string;
    query: string;
    rationale?: string;
    kb_id?: number;
    error?: string;
  }[];
}

const SECTIONS: { key: string; title: string; fields: [string, string, string?][] }[] = [
  { key: "target", title: "Profilo target ideale", fields: [
      ["settore", "Settore", "es. lusso, energia, certificati"],
      ["dimensione", "Dimensione", "es. PMI 10-50 dipendenti"],
      ["fatturatoMin", "Fatturato minimo", "in Mln €"],
      ["area", "Area geografica", "es. Nord-Est Italia"],
      ["tipoCliente", "Tipo cliente", "es. B2B, hotel 5*, yatch"],
  ]},
  { key: "eleggibilita", title: "Criteri di eleggibilità", fields: [
      ["criteriPositivi", "Criteri positivi", "cosa rende fit"],
      ["criteriEscludenti", "Criteri escludenti", "cosa squalifica"],
      ["note", "Note"],
  ]},
  { key: "fonti", title: "Fonti e conoscenza", fields: [
      ["bandi", "Bandi / programmi rilevanti"],
      ["competitor", "Competitor analizzati"],
      ["riferimenti", "Database / fonti consultate"],
  ]},
];

export default function RelationScoutingPanel({
  relationId,
  relationName,
  scouting,
  onClose,
  onSaved,
}: {
  relationId: number;
  relationName: string;
  scouting: RelationScoutingData | null;
  onClose: () => void;
  onSaved?: (s: RelationScoutingData) => void;
}) {
  const [form, setForm] = useState<Record<string, Record<string, string>>>(
    (scouting?.data as any) || {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(scouting?.savedAt || null);

  // 01/10/2026 (F3.A): toggle vista. Default AUTO se il payload è auto-generato.
  const isAuto = scouting?.generated_by === 'auto' || scouting?.schemaVersion === 2;
  const [view, setView] = useState<'auto' | 'manual'>(isAuto ? 'auto' : 'manual');
  const [rescouting, setRescouting] = useState(false);
  const [rescoutMsg, setRescoutMsg] = useState<string | null>(null);
  const [localScouting, setLocalScouting] = useState<RelationScoutingData | null>(scouting);

  const handleRescout = async () => {
    setRescouting(true);
    setRescoutMsg(null);
    try {
      const r = await fetch(`/api/admin/partner-projects/${relationId}/scouting-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Errore');
      setRescoutMsg('Scouting completato. Ricarico dati…');

      // Il backend POST è sincrono ma la write potrebbe non essere
      // ancora leggibile (edge case transazionale). Retry con backoff.
      let loaded = false;
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const r2 = await fetch(`/api/admin/partner-projects/${relationId}`);
          const d2 = await r2.json();
          // Il backend ritorna relationScouting già parsato (vedi route.ts)
          const sc = d2?.project?.relationScouting ?? null;
          if (sc && (sc.queries || sc.results)) {
            setLocalScouting(sc);
            loaded = true;
            break;
          }
          // Fallback: campo raw
          if (d2?.project?.x_v6_scouting) {
            try {
              const parsed = JSON.parse(d2.project.x_v6_scouting);
              if (parsed && (parsed.queries || parsed.results)) {
                setLocalScouting(parsed);
                loaded = true;
                break;
              }
            } catch {}
          }
        } catch {}
      }

      if (loaded) {
        setRescoutMsg('✅ Scouting aggiornato');
        setTimeout(() => setRescoutMsg(null), 3000);
      } else {
        setRescoutMsg('⚠️ Scouting avviato ma dati non ancora disponibili. Riprova tra 30 sec.');
      }
    } catch (e: any) {
      setRescoutMsg(`Errore: ${e.message}`);
    } finally {
      setRescouting(false);
    }
  };

  const update = (sec: string, field: string, val: string) => {
    setForm((prev) => ({
      ...prev,
      [sec]: { ...(prev[sec] || {}), [field]: val },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partner-projects/${relationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scouting: { data: form } }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Salvataggio fallito"); return; }
      setSavedAt(new Date().toISOString());
      onSaved?.({ data: form, savedAt: new Date().toISOString() });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
              <Target size={15} className="text-indigo-600" />
              Scouting Relazione — {relationName}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Profilo target del progetto, non di singola azienda. Alimenta lo scoring dello scouting aziende.
              {savedAt && <span className="ml-2 text-gray-400">· salvato {new Date(savedAt).toLocaleString('it-IT')}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg">
              <button
                onClick={() => setView('auto')}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
                  view === 'auto' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Bot size={11} /> Auto
              </button>
              <button
                onClick={() => setView('manual')}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
                  view === 'manual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Target size={11} /> Manuale
              </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* VISTA MANUALE (compilazione utente) */}
          {view === 'manual' && (
            <>
              {SECTIONS.map((sec) => (
                <div key={sec.key}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">{sec.title}</h4>
                  <div className="space-y-2">
                    {sec.fields.map(([fkey, flabel, hint]) => (
                      <div key={fkey}>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">{flabel}</label>
                        <input
                          value={(form[sec.key]?.[fkey] as string) || ""}
                          onChange={(e) => update(sec.key, fkey, e.target.value)}
                          placeholder={hint || ""}
                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* VISTA AUTO (scouting AI-driven) */}
          {view === 'auto' && (
            <div className="space-y-4">
              {localScouting && (localScouting.queries || localScouting.results) ? (
                <>
                  {/* Header info */}
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Bot size={14} className="text-indigo-600" />
                    <span className="font-semibold">Generato automaticamente</span>
                    {localScouting.generated_at && (
                      <span className="text-gray-400">
                        · {new Date(localScouting.generated_at).toLocaleString('it-IT')}
                      </span>
                    )}
                  </div>

                  {/* Query AI */}
                  {localScouting.queries && localScouting.queries.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                        Query generate ({localScouting.queries.length})
                      </h4>
                      <div className="space-y-1">
                        {localScouting.queries.map((q, i) => (
                          <div key={i} className="flex items-start gap-2 px-2 py-1.5 bg-indigo-50 rounded text-xs">
                            <Search size={11} className="text-indigo-600 shrink-0 mt-0.5" />
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fonti usate */}
                  {localScouting.sources_used && localScouting.sources_used.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                        Fonti utilizzate ({localScouting.sources_used.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {localScouting.sources_used.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risultati */}
                  {localScouting.results && localScouting.results.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                        Risultati ({localScouting.results.filter((r) => !r.error).length}/{localScouting.results.length})
                      </h4>
                      <div className="space-y-1.5">
                        {localScouting.results.map((r, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded text-xs border ${
                              r.error ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              {r.error ? (
                                <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                              ) : (
                                <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                              )}
                              <span className="font-semibold text-gray-700">{r.fetch_type}</span>
                              <span className="text-gray-400 truncate">· {r.query}</span>
                            </div>
                            {r.rationale && !r.error && (
                              <div className="text-gray-500 text-[10px] ml-4">{r.rationale}</div>
                            )}
                            {r.error && (
                              <div className="text-amber-700 text-[10px] ml-4 mt-0.5">{r.error.slice(0, 200)}</div>
                            )}
                            {r.kb_id && (
                              <div className="text-emerald-700 text-[10px] ml-4 mt-0.5 flex items-center gap-1">
                                <ExternalLink size={9} /> KB #{r.kb_id}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400 text-xs">
                  <Bot size={24} className="mx-auto mb-2 text-gray-300" />
                  Nessuno scouting automatico ancora eseguito.
                  <br />Compila il charter e clicca "Riscouta".
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50 rounded-b-xl">
          <div className="text-[11px] text-gray-500">
            {rescoutMsg ? (
              <span className="text-emerald-700">{rescoutMsg}</span>
            ) : error ? (
              <span className="text-red-600">{error}</span>
            ) : view === 'auto' ? (
              "Scouting automatico. Riscouta per forzare una nuova esecuzione."
            ) : (
              "Compila i campi e salva. Puoi tornare a modificarli quando vuoi."
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-white">Chiudi</button>
            {view === 'auto' ? (
              <button onClick={handleRescout} disabled={rescouting}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5">
                {rescouting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {rescouting ? "Riscouto…" : "🔍 Riscouta"}
              </button>
            ) : (
              <button onClick={save} disabled={saving}
                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? "Salvo…" : "Salva"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
