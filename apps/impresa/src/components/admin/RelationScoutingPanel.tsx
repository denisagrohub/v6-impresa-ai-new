"use client";
import { useState } from "react";
import { X, Loader2, Save, Target } from "lucide-react";

export interface RelationScoutingData {
  schemaVersion?: number;
  version?: number;
  savedAt?: string;
  data?: Record<string, any>;
  history?: any[];
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
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
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50 rounded-b-xl">
          <div className="text-[11px] text-gray-500">
            {error ? <span className="text-red-600">{error}</span> : "Compila i campi e salva. Puoi tornare a modificarli quando vuoi."}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-white">Chiudi</button>
            <button onClick={save} disabled={saving}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
