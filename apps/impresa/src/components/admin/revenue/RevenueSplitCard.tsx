"use client";
import { useState } from "react";
import { Plus, X, Users, ShieldCheck, AlertCircle, Lock } from "lucide-react";

interface Beneficiario {
  res_partner_id: number | null;
  nome: string;
  tipo: 'consulente' | 'referral' | 'altro';
  pct: number;
}

export default function RevenueSplitCard({
  projectId,
  projectName,
  baseCompenso,
  partners,
  onReload,
}: {
  projectId: number;
  projectName: string;
  baseCompenso: { tipo: string; valore: number; unita: string } | null;
  partners: { id: number; partnerName: string | null; partnerId: number | null }[];
  onReload?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [beneficiari, setBeneficiari] = useState<Beneficiario[]>([]);
  const [riserva, setRiserva] = useState(100);
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/admin/partner-projects/${projectId}/revenue-split`);
      const d = await r.json();
      if (d.success && d.split) {
        setBeneficiari(d.split.beneficiari || []);
        setRiserva(d.split.riserva_v6_pct ?? 100);
        setNote(d.split.note || "");
      }
      setApproved(!!d.approved);
      setApprovedAt(d.approvedAt);
      setHash(d.hash);
    } catch {}
  };

  const openModal = async () => {
    setOpen(true); setErr(null); setSaved(null);
    await load();
  };

  const somma = beneficiari.reduce((s, b) => s + (b.pct || 0), 0) + riserva;
  const ok = Math.abs(somma - 100) < 0.001;

  const addBenef = () => setBeneficiari([...beneficiari, { res_partner_id: null, nome: '', tipo: 'consulente', pct: 0 }]);
  const updateBenef = (i: number, patch: Partial<Beneficiario>) =>
    setBeneficiari(beneficiari.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const removeBenef = (i: number) => setBeneficiari(beneficiari.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true); setErr(null); setSaved(null);
    try {
      const r = await fetch(`/api/admin/partner-projects/${projectId}/revenue-split`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base: baseCompenso || {},
          beneficiari,
          riserva_v6_pct: riserva,
          note,
        }),
      });
      const d = await r.json();
      if (!d.success) { setErr(d.error); return; }
      setSaved("Salvato");
      onReload?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!confirm("Approvare lo split? Diventerà immutabile e ancorato su Bitcoin.")) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/partner-projects/${projectId}/revenue-split/approve`, { method: 'POST' });
      const d = await r.json();
      if (!d.success) { setErr(d.error); return; }
      setApproved(true); setApprovedAt(d.approvedAt); setHash(d.hash);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const calcolaImporto = (pct: number) => {
    if (!baseCompenso) return '—';
    const quota = baseCompenso.valore * (pct / 100);
    if (baseCompenso.tipo === 'fisso_unita') return `${quota.toFixed(4)} €/${baseCompenso.unita || 'u'}`;
    return `${quota.toFixed(4)} %`;
  };

  return (
    <>
      <button
        onClick={openModal}
        className="w-full bg-white rounded-2xl border border-gray-100 p-3 hover:border-violet-300 transition-colors text-left group"
      >
        <div className="flex items-center gap-2 mb-1">
          <Users size={13} className="text-violet-600" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Split V6</h2>
          {approved && <Lock size={11} className="text-emerald-600" />}
          <span className="ml-auto text-[10px] text-gray-400 group-hover:text-violet-500">
            {approved ? 'Approvato' : 'Configura →'}
          </span>
        </div>
        <p className="text-[10px] text-gray-500">
          {baseCompenso
            ? `${baseCompenso.valore} ${baseCompenso.tipo === 'fisso_unita' ? '€/' + (baseCompenso.unita || 'unità') : '% sul valore'}`
            : 'Configura base compenso nel charter'}
        </p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Split V6 — {projectName}
                {approved && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={10} /> Approvato</span>}
              </h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
            </div>

            {baseCompenso && (
              <div className="bg-violet-50 border border-violet-100 rounded p-3 mb-4 text-xs">
                <span className="font-semibold text-violet-900">Base compenso V6:</span>{' '}
                {baseCompenso.tipo === 'fisso_unita'
                  ? `${baseCompenso.valore} € per ${baseCompenso.unita || 'unità'}`
                  : `${baseCompenso.valore}% sul valore`}
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Beneficiari</span>
                {!approved && (
                  <button onClick={addBenef} className="text-violet-600 hover:text-violet-800 text-xs flex items-center gap-1">
                    <Plus size={12} /> Aggiungi
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {beneficiari.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded p-2">
                    <select
                      value={b.res_partner_id || ''}
                      onChange={(e) => {
                        const pid = parseInt(e.target.value, 10);
                        const p = partners.find((x) => (x.partnerId || x.id) === pid);
                        updateBenef(i, { res_partner_id: pid || null, nome: p?.partnerName || '' });
                      }}
                      disabled={approved}
                      className="flex-1 px-2 py-1 rounded border text-xs disabled:bg-gray-100"
                    >
                      <option value="">— scegli persona —</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.partnerId || p.id}>{p.partnerName || '?'}</option>
                      ))}
                    </select>
                    <select
                      value={b.tipo}
                      onChange={(e) => updateBenef(i, { tipo: e.target.value as any })}
                      disabled={approved}
                      className="px-2 py-1 rounded border text-xs disabled:bg-gray-100"
                    >
                      <option value="consulente">Consulente</option>
                      <option value="referral">Referral</option>
                      <option value="altro">Altro</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} step={0.005}
                        value={b.pct}
                        onChange={(e) => updateBenef(i, { pct: parseFloat(e.target.value) || 0 })}
                        disabled={approved}
                        className="w-20 px-2 py-1 rounded border text-xs text-right disabled:bg-gray-100"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                    <span className="text-[10px] text-violet-700 font-mono tabular-nums w-24 text-right">
                      {calcolaImporto(b.pct)}
                    </span>
                    {!approved && (
                      <button onClick={() => removeBenef(i)} className="text-red-400 hover:text-red-600"><X size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded p-2 mb-3">
              <span className="flex-1 text-xs font-semibold text-emerald-900">Riserva V6</span>
              <input
                type="number" min={0} max={100} step={0.005}
                value={riserva}
                onChange={(e) => setRiserva(parseFloat(e.target.value) || 0)}
                disabled={approved}
                className="w-20 px-2 py-1 rounded border text-xs text-right disabled:bg-gray-100"
              />
              <span className="text-xs text-gray-500">%</span>
              <span className="text-[10px] text-emerald-700 font-mono tabular-nums w-24 text-right">
                {calcolaImporto(riserva)}
              </span>
            </div>

            <div className={`flex items-center justify-between rounded p-2 mb-3 text-xs font-semibold ${
              ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}>
              <span>Totale</span>
              <span className="font-mono tabular-nums">{somma.toFixed(3)}%</span>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={approved}
              placeholder="Note (es. Enzo 1€/TEE fuori perimetro)"
              rows={2}
              className="w-full px-2 py-1.5 rounded border text-xs mb-3 disabled:bg-gray-100 resize-y"
            />

            {approved && approvedAt && (
              <div className="text-[10px] text-emerald-700 bg-emerald-50 rounded p-2 mb-3 flex items-center gap-1">
                <ShieldCheck size={11} /> Approvato il {new Date(approvedAt).toLocaleString('it-IT')} · Hash: {hash?.slice(0, 16)}…
              </div>
            )}

            {err && <p className="text-xs text-red-600 mb-2 flex items-center gap-1"><AlertCircle size={11} /> {err}</p>}
            {saved && <p className="text-xs text-emerald-600 mb-2">✓ {saved}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-600">Chiudi</button>
              {!approved && (
                <>
                  <button onClick={save} disabled={busy || !ok}
                    className="px-3 py-1.5 rounded border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-50 disabled:opacity-40">
                    {busy ? '…' : 'Salva bozza'}
                  </button>
                  <button onClick={approve} disabled={busy || !ok}
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1">
                    <Lock size={11} /> Approva + Blockchain
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
