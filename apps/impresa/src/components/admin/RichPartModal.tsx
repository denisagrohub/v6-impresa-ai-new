'use client';
import { useEffect, useState } from 'react';

export function RichPartModal({ projectId, onClose, onAdded }: {
  projectId: number; onClose: () => void; onAdded: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', ruolo: '', companyName: '' });
  const [companyResults, setCompanyResults] = useState<{ id: number; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // autocomplete AZIENDA — debounce 300ms (riusa la search esistente)
  useEffect(() => {
    if (companyId || form.companyName.trim().length < 2) { setCompanyResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/partners/search?q=${encodeURIComponent(form.companyName.trim())}`)
        .then(r => r.json()).then(d => {
          if (d.success) setCompanyResults((d.partners || []).filter((p: any) => p.is_company));
        }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [form.companyName, companyId]);

  const save = async () => {
    if (!form.name.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/partner-projects/${projectId}/parts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Creazione fallita');
      onAdded(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Errore'); } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'companyName') setCompanyId(null); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold">Nuova Parte — Scheda Completa</h3>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Persona</p>
          {([['name', 'Nome e cognome *'], ['email', 'Email'], ['phone', 'Telefono'], ['ruolo', 'Ruolo / mansione']] as const).map(([k, ph]) => (
            <input key={k} placeholder={ph} value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)}
              className="w-full rounded border border-gray-300 p-2 text-sm" />
          ))}
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Azienda (opzionale)</p>
          <div className="relative">
            <input placeholder="Nome azienda — cerca nel CRM o crea nuova" value={form.companyName}
              onChange={e => set('companyName', e.target.value)}
              className="w-full rounded border border-gray-300 p-2 text-sm" />
            {companyResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-36 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-md">
                {companyResults.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => { setCompanyId(c.id); setForm(f => ({ ...f, companyName: c.name })); setCompanyResults([]); }}
                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                    🏢 {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.companyName && !companyId && (
            <p className="text-[11px] text-gray-400">L&apos;azienda verrà creata nel CRM se non esiste.</p>
          )}
        </div>
        {error && <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-600">⚠️ {error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">Annulla</button>
          <button onClick={save} disabled={saving}
            className="rounded bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50 cursor-pointer">
            {saving ? 'Salvataggio…' : 'Crea parte'}
          </button>
        </div>
      </div>
    </div>
  );
}
