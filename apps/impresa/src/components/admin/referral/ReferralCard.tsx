"use client";
import { useState } from "react";
import { Loader2, Plus, X, User, ExternalLink, ShieldCheck, TrendingUp, AlertCircle, FileText, Send } from "lucide-react";

export interface Referral {
  id: number;
  name: string;
  segnalanteName: string | null;
  segnalanteEmail: string | null;
  segnalanteId: number | null;
  relationId: number | null;
  relationName: string | null;
  targetId: number | null;
  targetName: string | null;
  contattoNome: string | null;
  contattoRecapito: string | null;
  commissionePct: number;
  commissioneLocked: boolean;
  commissioneLockedAt: string | null;
  commissioneHash: string | null;
  state: string;
  creatoIl: string;
  blockchainRecordId: number | null;
}

const STATE_LABEL: Record<string, { label: string; cls: string }> = {
  bozza:      { label: "📝 Bozza",       cls: "bg-gray-100 text-gray-700" },
  in_firma:   { label: "✍️ In firma",    cls: "bg-amber-100 text-amber-800" },
  attivo:     { label: "✅ Attivo",       cls: "bg-emerald-100 text-emerald-800" },
  chiuso_ok:  { label: "🏆 Chiuso OK",   cls: "bg-emerald-200 text-emerald-900" },
  chiuso_no:  { label: "❌ Chiuso NO",   cls: "bg-red-100 text-red-700" },
};

export default function ReferralCard({
  relationId,
  relationName,
  referrals,
  partners,
  onOpenPerson,
  onReload,
}: {
  relationId: number;
  relationName: string;
  referrals: Referral[];
  partners: { id: number; partnerName: string | null; partnerId: number | null }[];
  onOpenPerson: (p: any) => void;
  onReload: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [segnalanteId, setSegnalanteId] = useState<number | "">("");
  const [contattoNome, setContattoNome] = useState("");
  const [contattoRecapito, setContattoRecapito] = useState("");
  const [commissione, setCommissione] = useState(5);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAgreement, setBusyAgreement] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationId,
          segnalantePartnerId: segnalanteId || undefined,
          contattoNome,
          contattoRecapito,
          commissionePct: commissione,
          note,
        }),
      });
      const d = await r.json();
      if (!d.success) { setErr(d.error); return; }
      setAddOpen(false);
      setSegnalanteId(""); setContattoNome(""); setContattoRecapito(""); setCommissione(5); setNote("");
      onReload();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const generateAgreement = async (id: number) => {
    setBusyAgreement(id);
    try {
      const r = await fetch(`/api/admin/referrals/${id}/generate-agreement`, { method: 'POST' });
      const d = await r.json();
      if (!d.success) { alert(d.error); return; }
      // Apri il PDF in una nuova tab per anteprima
      window.open(`/api/admin/referrals/${id}/pdf`, '_blank');
      onReload();
    } catch (e: any) { alert(e.message); }
    finally { setBusyAgreement(null); }
  };

  const sendToSign = async (id: number, segnalanteNome: string, segnalanteEmail: string | null) => {
    if (!segnalanteEmail) {
      alert(`Il segnalante "${segnalanteNome}" non ha un'email configurata.\nAggiungila nella scheda persona prima di inviare la firma.`);
      return;
    }
    const ok = confirm(
      `Inviare l'accordo per firma a:\n\n` +
      `Segnalante: ${segnalanteNome}\n` +
      `Email: ${segnalanteEmail}\n\n` +
      `Il segnalante riceverà un'email da Documenso con il link per firmare.\n` +
      `L'operazione è irreversibile (puoi annullare da Documenso).\n\n` +
      `Procedere?`
    );
    if (!ok) return;

    setBusyAgreement(id);
    try {
      const r = await fetch(`/api/admin/referrals/${id}/send-to-sign`, { method: 'POST' });
      const d = await r.json();
      if (!d.success) { alert(d.error); return; }
      alert(`Firma inviata a ${segnalanteNome} (${segnalanteEmail}).`);
      onReload();
    } catch (e: any) { alert(e.message); }
    finally { setBusyAgreement(null); }
  };

  const anchor = async (id: number) => {
    try {
      await fetch(`/api/admin/referrals/${id}/anchor`, { method: 'POST' });
      onReload();
    } catch {}
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <TrendingUp size={13} className="text-violet-600" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Referral commerciali
        </h2>
        <span className="text-[10px] text-gray-400">({referrals.length})</span>
        <button
          onClick={() => setAddOpen(true)}
          className="ml-auto text-violet-600 hover:text-violet-800 p-1"
          title="Nuovo referral"
        >
          <Plus size={14} />
        </button>
      </div>

      {referrals.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic px-1 py-2">
          Nessun referral. Aggiungine uno per tracciare chi ti ha portato un contatto.
        </p>
      ) : (
        <div className="space-y-1.5">
          {referrals.map((ref) => {
            const st = STATE_LABEL[ref.state] || STATE_LABEL.bozza;
            return (
              <div key={ref.id} className="border border-gray-100 rounded p-2 hover:border-violet-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#0f172a] truncate">
                      {ref.contattoNome || '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <User size={9} />
                      {ref.segnalanteName || 'Segnalante sconosciuto'}
                      <span className={`ml-1 font-semibold ${ref.commissioneLocked ? 'text-emerald-700' : 'text-violet-700'}`}>
                        {ref.commissioneLocked && '🔒 '}{ref.commissionePct}%
                      </span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-gray-400">
                  {ref.blockchainRecordId ? (
                    <span className="text-[9px] text-emerald-600 flex items-center gap-0.5" title="Ancorato su blockchain">
                      <ShieldCheck size={10} /> OTS
                    </span>
                  ) : (
                    <button
                      onClick={() => anchor(ref.id)}
                      className="text-[9px] text-violet-600 hover:text-violet-800 flex items-center gap-0.5"
                      title="Ancora su OpenTimestamps"
                    >
                      <ShieldCheck size={10} /> Ancora
                    </button>
                  )}
                  <button
                    onClick={() => generateAgreement(ref.id)}
                    disabled={busyAgreement === ref.id}
                    className="text-[9px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 disabled:opacity-40"
                    title="Genera PDF accordo (Typst)">
                    {busyAgreement === ref.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                    Accordo
                  </button>
                  <button
                    onClick={() => sendToSign(ref.id, ref.segnalanteName || '', (ref as any).segnalanteEmail || null)}
                    disabled={busyAgreement === ref.id}
                    className="text-[9px] text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 disabled:opacity-40"
                    title="Invia per firma (Documenso)">
                    {busyAgreement === ref.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    Firma
                  </button>
                  {ref.targetId && (
                    <span className="ml-auto text-[9px] text-gray-500 flex items-center gap-0.5">
                      <ExternalLink size={9} /> {ref.targetName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NUOVO REFERRAL */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">Nuovo referral — {relationName}</h3>

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Segnalante</label>
            <select
              value={segnalanteId}
              onChange={(e) => setSegnalanteId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full px-2 py-1.5 rounded border text-xs mb-3"
            >
              <option value="">— scegli persona del progetto —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.partnerId || p.id}>{p.partnerName || '?'}</option>
              ))}
            </select>

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Contatto segnalato *</label>
            <input value={contattoNome} onChange={(e) => setContattoNome(e.target.value)}
              placeholder="Nome / azienda" className="w-full px-2 py-1.5 rounded border text-xs mb-2" />

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Recapito</label>
            <input value={contattoRecapito} onChange={(e) => setContattoRecapito(e.target.value)}
              placeholder="Email o telefono" className="w-full px-2 py-1.5 rounded border text-xs mb-2" />

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Commissione %</label>
            <input type="number" min={0} max={100} value={commissione}
              onChange={(e) => setCommissione(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded border text-xs mb-2" />

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full px-2 py-1.5 rounded border text-xs mb-3 resize-y" />

            {err && <p className="text-xs text-red-600 mb-2 flex items-center gap-1"><AlertCircle size={11} /> {err}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="px-3 py-1.5 text-xs text-gray-600">Annulla</button>
              <button onClick={save} disabled={busy || !contattoNome.trim() || !segnalanteId}
                className="px-3 py-1.5 rounded bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1.5">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {busy ? "Creo…" : "Crea referral"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
