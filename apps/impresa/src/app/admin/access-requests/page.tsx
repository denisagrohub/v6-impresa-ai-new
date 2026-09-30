// ═══════════════════════════════════════════════════════════════════
// /admin/access-requests — gestione richieste accesso playbook progetti.
//
// Blocco 5a (30/09/2026): admin o chief_projects approva/rifiuta le
// richieste inviate dai consultant dal catalogo playbook.
// Su approvazione (default): consultant aggiunto ad access_user_ids
// + creato nodo parte figlio.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, ArrowLeft, CheckCircle2, XCircle, Clock, User, Building2,
  MessageCircle, History, RefreshCw, Send,
} from 'lucide-react';

type AccessRequest = {
  id: number;
  relationId: number;
  relationName: string;
  userId: number;
  userName: string;
  userEmail: string;
  partnerId: number | null;
  partnerName: string | null;
  message: string;
  state: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createsPartNode: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string;
  createDate: string | null;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
};

const STATE_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending:   { label: 'In attesa', cls: 'bg-amber-50 text-amber-800 border-amber-300', Icon: Clock },
  approved:  { label: 'Approvata', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: CheckCircle2 },
  rejected:  { label: 'Rifiutata', cls: 'bg-red-50 text-red-700 border-red-300', Icon: XCircle },
  cancelled: { label: 'Annullata', cls: 'bg-gray-50 text-gray-600 border-gray-300', Icon: XCircle },
};

export default function AccessRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  // Modale approva
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveReq, setApproveReq] = useState<AccessRequest | null>(null);
  const [approvePartNode, setApprovePartNode] = useState(true);

  // Modale rifiuta
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReq, setRejectReq] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const authHeaders = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem('pi_session');
      const s = raw ? JSON.parse(raw) : null;
      return s?.token ? { Authorization: `JWT ${s.token}` } : {};
    } catch { return {}; }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = showAll ? '?all=1' : '';
      const r = await fetch(`/api/admin/access-requests${qs}`, { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Errore'); return; }
      const list = d.requests || d.data?.requests || [];
      setRequests(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem('pi_session');
    if (!raw) { router.push('/login'); return; }
    loadData();
  }, [router, showAll]);

  const openApprove = (r: AccessRequest) => {
    setApproveReq(r);
    setApprovePartNode(r.createsPartNode);
    setApproveOpen(true);
  };

  const openReject = (r: AccessRequest) => {
    setRejectReq(r);
    setRejectReason('');
    setRejectOpen(true);
  };

  const doApprove = async () => {
    if (!approveReq) return;
    setActing(approveReq.id);
    try {
      const r = await fetch(`/api/admin/access-requests/${approveReq.id}/approve`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ createsPartNode: approvePartNode }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        alert(d.error || 'Errore approvazione');
      } else {
        setApproveOpen(false);
        await loadData();
      }
    } catch (e: any) { alert(e.message); }
    finally { setActing(null); }
  };

  const doReject = async () => {
    if (!rejectReq) return;
    setActing(rejectReq.id);
    try {
      const r = await fetch(`/api/admin/access-requests/${rejectReq.id}/reject`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        alert(d.error || 'Errore rifiuto');
      } else {
        setRejectOpen(false);
        await loadData();
      }
    } catch (e: any) { alert(e.message); }
    finally { setActing(null); }
  };

  const pendingCount = requests.filter(r => r.state === 'pending').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2744] flex items-center gap-2">
            <Send size={22} /> Richieste accesso playbook
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consultant che chiedono di entrare in un progetto dal catalogo.
            {pendingCount > 0 && <span className="ml-1 font-semibold text-amber-700">{pendingCount} in attesa</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 bg-white text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
              className="accent-indigo-600"
            />
            <History size={14} className="text-gray-500" /> Mostra storico
          </label>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Aggiorna
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <CheckCircle2 size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {showAll ? 'Nessuna richiesta registrata.' : 'Nessuna richiesta in attesa.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const meta = STATE_META[r.state] || STATE_META.pending;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${meta.cls}`}>
                        <meta.Icon size={10} /> {meta.label}
                      </span>
                      <span className="text-xs text-gray-400">#{r.id}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#1a2744] flex items-center gap-2">
                      <User size={14} className="text-indigo-600" />
                      {r.userName}
                    </h3>
                    <div className="text-xs text-gray-500">{r.userEmail}</div>
                  </div>
                  <div className="text-right text-xs text-gray-400 shrink-0">
                    {fmtDate(r.createDate)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-gray-400" />
                    Progetto: <Link href={`/admin/partner-projects/${r.relationId}`} className="text-[#0f3460] hover:underline font-medium">
                      {r.relationName}
                    </Link>
                  </span>
                  {r.partnerName && (
                    <span className="text-gray-500">Partner: <strong>{r.partnerName}</strong></span>
                  )}
                </div>

                {r.message && (
                  <div className="mb-3 p-2.5 rounded bg-gray-50 border border-gray-100 text-xs text-gray-700 flex gap-2">
                    <MessageCircle size={12} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="italic">{r.message}</span>
                  </div>
                )}

                {r.state === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openApprove(r)}
                      disabled={acting === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} /> Approva
                    </button>
                    <button
                      onClick={() => openReject(r)}
                      disabled={acting === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={12} /> Rifiuta
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    {r.state === 'approved' && (
                      <span>Approvata da <strong>{r.approvedBy}</strong> · {fmtDate(r.approvedAt)}{r.createsPartNode ? ' · con nodo parte' : ' · senza nodo parte'}</span>
                    )}
                    {r.state === 'rejected' && (
                      <span>Rifiutata da <strong>{r.approvedBy}</strong>{r.rejectedReason && <> · motivo: <em>{r.rejectedReason}</em></>}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE APPROVA */}
      {approveOpen && approveReq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !acting && setApproveOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a2744] mb-1">Approva richiesta</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{approveReq.userName}</strong> entrerà in <strong>{approveReq.relationName}</strong>.
            </p>
            <label className="flex items-start gap-2 p-3 rounded border border-gray-200 bg-gray-50 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={approvePartNode}
                onChange={e => setApprovePartNode(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-gray-800">Crea nodo parte</div>
                <div className="text-gray-500 mt-0.5">
                  Il consultant diventa anche &quot;parte&quot; del progetto (nodo figlio).
                  Deseleziona per dare solo accesso al playbook senza agganciarlo alla struttura.
                </div>
              </div>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApproveOpen(false)}
                disabled={acting !== null}
                className="px-4 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={doApprove}
                disabled={acting !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {acting ? 'Approvazione…' : 'Conferma approvazione'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE RIFIUTA */}
      {rejectOpen && rejectReq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !acting && setRejectOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a2744] mb-1">Rifiuta richiesta</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{rejectReq.userName}</strong> · {rejectReq.relationName}
            </p>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Motivo (opzionale)
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Es. ruolo non compatibile, contatti insufficienti…"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none mb-4"
              disabled={acting !== null}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectOpen(false)}
                disabled={acting !== null}
                className="px-4 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={doReject}
                disabled={acting !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                {acting ? 'Rifiuto…' : 'Conferma rifiuto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
