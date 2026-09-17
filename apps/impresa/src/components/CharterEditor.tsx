'use client';
import { useState } from 'react';

export interface CharterData {
  version?: number;
  origin?: string;
  regulatoryContext?: string;
  requirements?: string;
  commercialTerms?: string;
  currentPhase?: string;
  confidentiality?: string;
  history?: { version: number; savedAt: string; data: Record<string, string> }[];
}

const FIELDS: { key: keyof CharterData; label: string; placeholder: string; textarea?: boolean }[] = [
  { key: 'origin', label: 'Origine', placeholder: 'Es. Richiedente qualificato cerca partner per obbligo normativo…', textarea: true },
  { key: 'regulatoryContext', label: 'Contesto normativo', placeholder: 'Es. Committente con founding e rolling 12/24 attivi' },
  { key: 'requirements', label: 'Requisiti', placeholder: 'Es. Blocchi min 10.000 TEE/mese, max 1M titoli/mese…', textarea: true },
  { key: 'commercialTerms', label: 'Termini commerciali', placeholder: 'Es. Commissione a carico VENDITORE; quota V6 = 2 punti…', textarea: true },
  { key: 'currentPhase', label: 'Fase attuale', placeholder: 'Es. Scouting approfondito → ricerca aziende' },
  { key: 'confidentiality', label: 'Riservatezza', placeholder: 'Es. MAI nominare il committente in documenti/email/contesti AI esterni', textarea: true },
];

export function CharterEditor({ projectId, charter, onChanged }: {
  projectId: number;
  charter: CharterData | null;
  onChanged?: (c: CharterData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const present = !!charter;
  const version = charter?.version ?? 0;

  const openModal = () => {
    const initial: Record<string, string> = {};
    for (const f of FIELDS) initial[f.key] = (charter?.[f.key] as string) ?? '';
    setForm(initial);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/partner-projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charter: { data: form } }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      onChanged?.({ ...form, version: json.version, history: charter?.history });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className={`ml-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
          present
            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
            : 'animate-pulse border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
        }`}
        title={present ? `Charter v${version} — clicca per visualizzare/modificare` : 'Charter mancante — clicca per compilarla'}
      >
        📋 Charter
        {present && (
          <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            v{version}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Charter del Progetto
                {present && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">v{version}</span>}
              </h3>
              {charter?.history && charter.history.length > 0 && (
                <div className="text-xs text-gray-500" title={charter.history.map(h => `vh.version—{h.version} —h.version—{new Date(h.savedAt).toLocaleString('it-IT')}`).join('\n')}>
                  🕘 {charter.history.length} versioni precedenti
                </div>
              )}
            </div>

            <div className="space-y-3">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{f.label}</label>
                  {f.textarea ? (
                    <textarea
                      rows={2}
                      className="w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={f.placeholder}
                      value={form[f.key] ?? ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className="w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={f.placeholder}
                      value={form[f.key] ?? ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-600">⚠️ {error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">
                Annulla
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvataggio…' : present ? `Salva come v${version + 1}` : 'Crea charter (v1)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
