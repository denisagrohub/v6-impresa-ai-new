"use client";
import { useState } from "react";
import { Loader2, Plus, X, User, ExternalLink, ShieldCheck, TrendingUp, AlertCircle, FileText, Send, XCircle, Building2, Calendar, CheckCircle2, Clock } from "lucide-react";

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
  const [detailOpen, setDetailOpen] = useState<Referral | null>(null);
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

  const cancelSign = async (id: number, segnalanteNome: string) => {
    const ok = confirm(
      `Annullare l'invio della firma a ${segnalanteNome}?\n\n` +
      `L'envelope verrà cancellato su Documenso. Il referral torna in stato "bozza".`
    );
    if (!ok) return;
    setBusyAgreement(id);
    try {
      const r = await fetch(`/api/admin/referrals/${id}/cancel-sign`, { method: 'POST' });
      const d = await r.json();
      if (!d.success) { alert(d.error); return; }
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
              <button
                key={ref.id}
                onClick={() => setDetailOpen(ref)}
                className="w-full text-left border border-gray-100 rounded p-2 hover:border-violet-300 hover:bg-violet-50/40 transition-colors group"
              >
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
                  {ref.blockchainRecordId && (
                    <span className="text-[9px] text-emerald-600 flex items-center gap-0.5" title="Ancorato su blockchain">
                      <ShieldCheck size={10} /> OTS
                    </span>
                  )}
                  {(ref as any).accordoUrl && (
                    <span className="text-[9px] text-amber-600 flex items-center gap-0.5" title="Inviato per firma">
                      <Clock size={10} /> In firma
                    </span>
                  )}
                  <span className="ml-auto text-[9px] text-gray-400 group-hover:text-violet-600 flex items-center gap-0.5">
                    Apri <ExternalLink size={9} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* MODAL DETTAGLIO REFERRAL */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailOpen(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {/* HEADER */}
            <div className="border-b border-gray-100 px-5 py-4 flex items-start justify-between bg-gradient-to-r from-violet-50 to-white rounded-t-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Building2 size={18} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0f172a]">
                    {detailOpen.contattoNome || 'Referral'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <User size={11} /> {detailOpen.segnalanteName || '—'}
                    <span className="text-gray-300 mx-1">·</span>
                    <span className={detailOpen.commissioneLocked ? 'text-emerald-700 font-semibold' : 'text-violet-700 font-semibold'}>
                      {detailOpen.commissioneLocked && '🔒 '}{detailOpen.commissionePct}%
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                      backgroundColor: detailOpen.state === 'attivo' ? '#d1fae5' : detailOpen.state === 'in_firma' ? '#fef3c7' : detailOpen.state === 'chiuso_ok' ? '#a7f3d0' : detailOpen.state === 'chiuso_no' ? '#fee2e2' : '#f3f4f6',
                      color: detailOpen.state === 'attivo' ? '#065f46' : detailOpen.state === 'in_firma' ? '#92400e' : detailOpen.state === 'chiuso_ok' ? '#064e3b' : detailOpen.state === 'chiuso_no' ? '#991b1b' : '#374151',
                    }}>
                      {(STATE_LABEL[detailOpen.state] || STATE_LABEL.bozza).label}
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailOpen(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {/* BODY: info */}
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Recapito</div>
                  <div className="text-[#0f172a] font-medium break-all">
                    {detailOpen.contattoRecapito || '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Progetto</div>
                  <div className="text-[#0f172a] font-medium">{detailOpen.relationName || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Creato</div>
                  <div className="text-[#0f172a] font-medium flex items-center gap-1">
                    <Calendar size={11} />
                    {detailOpen.creatoIl ? new Date(detailOpen.creatoIl).toLocaleString('it-IT') : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Blockchain</div>
                  <div className="text-[#0f172a] font-medium">
                    {detailOpen.blockchainRecordId
                      ? <span className="text-emerald-700 flex items-center gap-1"><ShieldCheck size={11} /> Ancorato</span>
                      : <span className="text-gray-400">Non ancorato</span>}
                  </div>
                </div>
              </div>

              {detailOpen.commissioneLocked && (
                <div className="bg-emerald-50 border border-emerald-100 rounded p-2.5 text-xs">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1 mb-1">
                    <CheckCircle2 size={12} /> Commissione congelata
                  </div>
                  <div className="text-emerald-700">
                    {detailOpen.commissioneLockedAt && new Date(detailOpen.commissioneLockedAt).toLocaleString('it-IT')}
                  </div>
                  {detailOpen.commissioneHash && (
                    <div className="text-[10px] text-emerald-600 font-mono mt-1">
                      hash: {detailOpen.commissioneHash.slice(0, 24)}…
                    </div>
                  )}
                </div>
              )}

              {(detailOpen as any).accordoUrl && (
                <div className="bg-amber-50 border border-amber-100 rounded p-2.5 text-xs">
                  <div className="font-semibold text-amber-900 flex items-center gap-1 mb-1">
                    <Clock size={12} /> In attesa di firma
                  </div>
                  <a href={(detailOpen as any).accordoUrl} target="_blank" rel="noreferrer"
                     className="text-amber-700 underline break-all text-[10px]">
                    {(detailOpen as any).accordoUrl}
                  </a>
                </div>
              )}

              {detailOpen.targetId && (
                <div className="text-xs text-gray-600">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Target collegato: </span>
                  {detailOpen.targetName}
                </div>
              )}
            </div>

            {/* FOOTER: azioni grandi */}
            <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-2 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => generateAgreement(detailOpen.id)}
                disabled={busyAgreement === detailOpen.id}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5">
                {busyAgreement === detailOpen.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                Genera accordo PDF
              </button>
              <button
                onClick={() => sendToSign(detailOpen.id, detailOpen.segnalanteName || '', detailOpen.segnalanteEmail || null)}
                disabled={busyAgreement === detailOpen.id}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5">
                {busyAgreement === detailOpen.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Invia per firma
              </button>
              {detailOpen.state === 'in_firma' && (
                <button
                  onClick={() => { cancelSign(detailOpen.id, detailOpen.segnalanteName || ''); setDetailOpen(null); }}
                  disabled={busyAgreement === detailOpen.id}
                  className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-40 flex items-center gap-1.5">
                  <XCircle size={12} /> Annulla invio
                </button>
              )}
              {!detailOpen.blockchainRecordId && (
                <button
                  onClick={() => { anchor(detailOpen.id); setDetailOpen(null); }}
                  className="px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Ancora su blockchain
                </button>
              )}
              <button
                onClick={() => setDetailOpen(null)}
                className="ml-auto px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-white">
                Chiudi
              </button>
            </div>
          </div>
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
