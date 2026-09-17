'use client';
import { useState } from 'react';

export interface ScoutingData {
  schemaVersion: number; version: number; savedAt?: string;
  identita?: Record<string, string>;
  finanza?: Record<string, string>;
  posizionamento?: Record<string, string>;
  fit?: Record<string, string>;
  provenance?: Record<string, { valore: string; fonte: string; data: string }>;
  fonti?: string;
}

const SECTIONS: { key: string; title: string; fields: [string, string][] }[] = [
  { key: 'identita', title: 'Identità', fields: [['settore', 'Settore'], ['ateco', 'Codice ATECO'], ['dipendenti', 'Dipendenti'], ['sede', 'Sede'], ['sito', 'Sito web'], ['piva', 'P.IVA']] },
  { key: 'finanza', title: 'Finanza', fields: [['fatturatoMln', 'Fatturato (Mln €)'], ['ebitdaPct', 'EBITDA (%)'], ['dso', 'DSO (gg)'], ['note', 'Note finanziarie']] },
  { key: 'posizionamento', title: 'Posizionamento', fields: [['clientiChiave', 'Clienti chiave'], ['concorrenti', 'Concorrenti'], ['puntiDoloranti', 'Punti doloranti']] },
  { key: 'fit', title: 'Fit (TEE / progetti)', fields: [['founding', 'Founding (sì/no/dettagli)'], ['rolling12', 'Rolling 12'], ['rolling24', 'Rolling 24'], ['idoneita', 'Idoneità / osservazioni']] },
];

export function ScoutingModal({ partnerId, partnerName, scouting, onChanged }: {
  partnerId: number; partnerName: string; scouting: ScoutingData | null;
  onChanged?: (s: ScoutingData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const version = scouting?.version ?? 0;

  const buildPrompt = () =>
    `Fai uno scouting commerciale sintetico e STRUTTURATO dell'azienda "${partnerName}". ` +
    `Rispondi SOLO con valori separati da punto e virgola in quest'ordine:\n` +
    `settore; ateco; dipendenti; sede; sito web; piva; fatturato Mln €; ebitda %; dso giorni; ` +
    `clienti chiave; concorrenti; punti doloranti; founding sì/no; rolling 12 sì/no; rolling 24 sì/no; idoneità.\n` +
    `Se un dato non è noto scrisci "n.d". Nessun altro testo.`;

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildPrompt());
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // parsing risposta AI esterna (16 valori separati da ;)
  const parseAiReply = (raw: string) => {
    const v = raw.split(';').map(s => s.trim().replace(/^["']|["']$/g, ''));
    const [settore, ateco, dipendenti, sede, sito, piva, fatturato, ebitda, dso, clienti, concorrenti, dolori, founding, r12, r24, idoneita] = v;
    const next: Record<string, Record<string, string>> = {
      identita: { settore, ateco, dipendenti, sede, sito, piva },
      finanza: { fatturatoMln: fatturato, ebitdaPct: ebitda, dso },
      posizionamento: { clientiChiave: clienti, concorrenti, puntiDoloranti: dolori },
      fit: { founding, rolling12: r12, rolling24: r24, idoneita },
    };
    for (const k of Object.keys(next)) next[k] = Object.fromEntries(Object.entries(next[k]).filter(([, x]) => x && x !== 'n.d'));
    setForm(prev => ({ ...prev, ...next }));
  };

  const openModal = () => {
    const next: Record<string, Record<string, string>> = {};
    for (const s of SECTIONS) {
      next[s.key] = {};
      for (const [f] of s.fields) next[s.key][f] = String((scouting?.[s.key as keyof ScoutingData] as Record<string, string> | undefined)?.[f] ?? '');
    }
    setForm(next); setError(null); setOpen(true);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const data: ScoutingData = { schemaVersion: 1, version: version + 1, savedAt: new Date().toISOString(), ...form } as ScoutingData;
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scouting: data }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      onChanged?.(data); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Errore'); } finally { setSaving(false); }
  };

  return (
    <>
      <button onClick={() => { openModal(); }}
        className={`ml-1.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
          version ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`} title={version ? `Scouting v${version} — clicca per aprire` : 'Nessuno scouting — compila ora'}>
        🔍 Scouting {version ? `v${version}` : ''}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Scouting: {partnerName}
                {version > 0 && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">v{version}</span>}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={copyPrompt} title="Copia il prompt da incollare in ChatGPT/Gemini/OnAlpha"
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                  {copied ? '✅ Copiato!' : '📋 Prompt per AI esterna'}
                </button>
                <button onClick={() => {
                  const reply = window.prompt("Incolla qui la risposta dell'AI esterna (16 valori separati da ;)");
                  if (reply) parseAiReply(reply);
                }} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                  ⬇︎ Importa risposta
                </button>
              </div>
            </div>

            {SECTIONS.map(s => (
              <div key={s.key} className="mb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{s.title}</p>
                <div className="grid grid-cols-2 gap-2">
                  {s.fields.map(([f, label]) => (
                    <div key={f}>
                      <label className="mb-0.5 block text-[11px] text-gray-500">{label}</label>
                      <input value={form[s.key]?.[f] ?? ''}
                        onChange={e => setForm(p => ({ ...p, [s.key]: { ...p[s.key], [f]: e.target.value } }))}
                        className="w-full rounded border border-gray-300 p-1.5 text-xs" />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {error && <p className="rounded bg-red-50 p-2 text-xs text-red-600">⚠️ {error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">Annulla</button>
              <button onClick={save} disabled={saving}
                className="rounded bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50 cursor-pointer">
                {saving ? 'Salvataggio…' : version ? `Salva come v${version + 1}` : 'Crea scouting (v1)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
