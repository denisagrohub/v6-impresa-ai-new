"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, RefreshCw, Send, Edit, FileSignature,
  AlertCircle, CheckCircle2, Loader2, Download, Eye,
  Clock, Users, Building2, Rocket
} from "lucide-react";

type Contract = {
  id: number;
  name: string;
  state: string;
  templateId: number | null;
  templateCode: string | null;
  projectId: number | null;
  projectName: string | null;
  counterpartyId: number | null;
  counterpartyName: string | null;
  pdfMode: string;
  revision: number;
  revisionNotes: string | null;
  documentId: number | null;
  hasPdf: boolean;
  extraData: Record<string, any>;
  lastGeneratedAt: string | null;
};

const STATE_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "Bozza",           color: "bg-gray-100 text-gray-700" },
  generated: { label: "PDF Generato",    color: "bg-blue-100 text-blue-800" },
  sent:      { label: "Inviato",         color: "bg-amber-100 text-amber-800" },
  signed:    { label: "Firmato",         color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annullato",       color: "bg-gray-100 text-gray-500" },
};

export default function EditContractPage() {
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [extraDataText, setExtraDataText] = useState("{}");

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) { window.location.href = "/login"; return; }
    const u = JSON.parse(session);
    setUser(u);
    loadContract(u);
  }, [id]);

  const loadContract = async (u?: any) => {
    const session = u || user;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${id}`, {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Errore'); return; }
      setContract(data.contract);
      setExtraDataText(JSON.stringify(data.contract.extraData || {}, null, 2));
      if (data.contract.hasPdf) loadPdf(session);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const loadPdf = async (u?: any) => {
    const session = u || user;
    try {
      const res = await fetch(`/api/admin/contracts/${id}/pdf`, {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch {}
  };

  const saveExtraData = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      let parsed;
      try { parsed = JSON.parse(extraDataText); }
      catch (e) { setError('JSON non valido: ' + (e as Error).message); setBusy(false); return; }
      const res = await fetch(`/api/admin/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user?.token || ''}` },
        body: JSON.stringify({ extraData: parsed }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); setBusy(false); return; }
      setContract(data.contract);
      setMessage("Dati salvati. Ricorda di rigenerare il PDF.");
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const generate = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch(`/api/admin/contracts/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user?.token || ''}` },
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Errore generazione'); setBusy(false); return; }
      setMessage(`PDF generato (revisione ${data.revision}, ${data.pdf_size} byte)`);
      setTimeout(() => setMessage(null), 4000);
      await loadContract();
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const edit = async () => {
    if (!confirm("Riportare in bozza? Eventuali firme attive verranno annullate.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user?.token || ''}` },
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); setBusy(false); return; }
      setContract(data.contract);
      setMessage("Riportato in bozza. Puoi modificare i dati e rigenerare.");
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!confirm("Inviare per firma?\n\nAssicurati che il PDF sia quello definitivo.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user?.token || ''}` },
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); setBusy(false); return; }
      setContract({ ...contract!, state: 'sent' });
      setMessage("Inviato per firma.");
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 size={32} className="animate-spin text-[#1a2744]" />
    </div>;
  }

  if (error && !contract) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] gap-4">
      <AlertCircle size={48} className="text-red-500" />
      <p className="text-red-700">{error}</p>
      <Link href="/admin/contratti" className="text-[#0f3460] hover:underline">← Torna ai contratti</Link>
    </div>;
  }

  if (!contract) return null;

  const meta = STATE_META[contract.state] || { label: contract.state, color: "bg-gray-100" };
  const isSigned = contract.state === 'signed';

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc]">
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <Link href="/admin/contratti" className="p-1.5 rounded hover:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <FileSignature size={18} className="text-indigo-500" />
          <span className="font-semibold text-[#1a2744]">{contract.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${meta.color}`}>
            {meta.label} {contract.revision > 1 && `· r${contract.revision}`}
          </span>
          {contract.pdfMode === 'preview' && <span className="text-xs text-amber-600">Anteprima</span>}
        </div>
        <div className="flex-1" />
        {message && <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded">{message}</span>}
        {!isSigned && (
          <>
            <button onClick={saveExtraData} disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
              <Save size={14} /> Salva dati
            </button>
            <button onClick={generate} disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Rigenera PDF
            </button>
            {contract.state === 'sent' && (
              <button onClick={edit} disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5">
                <Edit size={14} /> Riedita
              </button>
            )}
            {(contract.state === 'generated' || contract.state === 'draft') && (
              <button onClick={send} disabled={busy || !contract.hasPdf}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                <Send size={14} /> Invia per firma
              </button>
            )}
          </>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: dati editabili */}
        <div className="w-[480px] flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Info</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Template:</span> <span className="font-mono text-xs">{contract.templateCode}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Progetto:</span> <span>{contract.projectName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Controparte:</span> <span>{contract.counterpartyName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Revisione:</span> <span>{contract.revision}</span></div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Dati aggiuntivi (JSON)</div>
              <textarea value={extraDataText}
                onChange={(e) => setExtraDataText(e.target.value)}
                disabled={isSigned}
                rows={18}
                className="w-full text-xs font-mono p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Compila i campi che il template si aspetta (es. <code>tipo_nda</code>, <code>fee_pct</code>).
                I dati da progetto/controparte sono auto-merge.
              </p>
            </div>

            {contract.lastGeneratedAt && (
              <div className="text-xs text-gray-500">
                <Clock size={12} className="inline mr-1" />
                Ultima generazione: {new Date(contract.lastGeneratedAt).toLocaleString('it-IT')}
              </div>
            )}

          </div>
        </div>

        {/* Right: PDF preview */}
        <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-2 flex-shrink-0 text-xs">
            <Eye size={12} className="text-gray-500" />
            <span className="font-semibold text-gray-700">Anteprima PDF</span>
            <div className="flex-1" />
            {contract.hasPdf && (
              <a href={`/api/admin/contracts/${id}/pdf`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#0f3460] hover:underline">
                <Download size={12} /> Apri in nuova tab
              </a>
            )}
          </div>
          <div className="flex-1 overflow-auto p-2">
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full bg-white rounded shadow" title="PDF" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <FileSignature size={32} />
                <p>Nessun PDF generato. Clicca <strong>Rigenera PDF</strong>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
