// ═══════════════════════════════════════════════════════════════════
// /consultant/playbook — i miei progetti + catalogo progetti + richieste.
//
// Blocco 3+5 (30/09/2026): flusso opt-in consultant + playbook diretti.
// - Sezione "I miei progetti": progetti dove il consultant è parte,
//   con link al playbook + link pubblico da condividere con aziende.
// - Sezione "Catalogo progetti": progetti pubblicati dove NON è parte,
//   con bottone "Richiedi accesso".
// - Sezione "Le mie richieste": stato delle richieste inviate.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, BookOpen, Send, Clock, CheckCircle2, XCircle, User,
  FileText, ExternalLink, Copy, Link2, Briefcase,
} from 'lucide-react';
import { ConsultantPageHeader } from '@/components/consultant/ConsultantPageHeader';

type MyProject = {
  id: number;
  name: string;
  state: string;
  email_alias: string | null;
  owner_name: string | null;
  has_split: boolean;
  split_approvato: boolean;
};

type CatalogProject = {
  id: number;
  name: string;
  pitchTitle: string;
  pitchSummary: string;
  ownerName: string | null;
  funzioneProgetto: string;
  publishedAt: string | null;
  pendingRequestId: number | null;
  emailAlias: string | null;
};

type MyRequest = {
  id: number;
  relationId: number;
  relationName: string;
  state: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message: string;
  rejectedReason: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createDate: string | null;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const STATE_META: Record<string, { label: string; color: string; Icon: typeof Clock }> = {
  pending:   { label: 'In attesa', color: 'bg-amber-50 text-amber-800 border-amber-300', Icon: Clock },
  approved:  { label: 'Approvata', color: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: CheckCircle2 },
  rejected:  { label: 'Rifiutata', color: 'bg-red-50 text-red-700 border-red-300', Icon: XCircle },
  cancelled: { label: 'Annullata', color: 'bg-gray-50 text-gray-600 border-gray-300', Icon: XCircle },
};

export default function PlaybookCatalogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [catalog, setCatalog] = useState<CatalogProject[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);

  // 30/09/2026: progetti già visti dall'utente (localStorage). Badge
  // NOVITÀ per progetti approvati ma mai aperti.
  const [seenProjects, setSeenProjects] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('seenProjects');
      const seen: number[] = raw ? JSON.parse(raw) : [];
      setSeenProjects(seen);
    } catch {}
  }, []);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestProject, setRequestProject] = useState<CatalogProject | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestSending, setRequestSending] = useState(false);

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
      const [myRes, catRes, reqRes] = await Promise.all([
        fetch('/api/consultant/partner-projects', { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
        fetch('/api/consultant/projects/catalog', { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
        fetch('/api/consultant/projects/my-requests', { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
      ]);

      // 30/09/2026: le risposte hanno `success` a livello TOP e `projects`
      // /`requests` dentro `data`. Non mischiare.
      if (myRes.success) setMyProjects(myRes.data?.projects || myRes.projects || []);
      if (catRes.success) setCatalog(catRes.data?.projects || catRes.projects || []);
      if (reqRes.success) setMyRequests(reqRes.data?.requests || reqRes.requests || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = localStorage.getItem('pi_session');
    if (!s) { router.push('/login'); return; }
    loadData();
  }, [router]);

  const handleOpenRequest = (p: CatalogProject) => {
    setRequestProject(p);
    setRequestMessage('');
    setRequestModalOpen(true);
  };

  const handleSendRequest = async () => {
    if (!requestProject) return;
    setRequestSending(true);
    try {
      const r = await fetch(`/api/consultant/projects/${requestProject.id}/request-access`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: requestMessage }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        alert(d.error || 'Errore invio richiesta');
      } else {
        setRequestModalOpen(false);
        await loadData();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRequestSending(false);
    }
  };

  const copyPublicLink = async (slug: string) => {
    try {
      const url = `${window.location.origin}/p/${slug}`;
      await navigator.clipboard.writeText(url);
      alert('Link pubblico copiato negli appunti:\n' + url);
    } catch (e: any) {
      alert('Impossibile copiare: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <ConsultantPageHeader
        title="Catalogo progetti"
        subtitle="I tuoi progetti, il catalogo V6 e le tue richieste di accesso."
        rightSlot={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
            <BookOpen size={12} /> {catalog.length} disponibili
          </span>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">

          {error && (
            <div className="mb-6 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
            </div>
          ) : (
            <>
              {/* ═══════════════════════════════════════════════════
                  SEZIONE 1 — I MIEI PROGETTI (dove sono parte)
                  ═══════════════════════════════════════════════════ */}
              <section className="mb-10">
                <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3 flex items-center gap-1.5">
                  <Briefcase size={12} /> I miei progetti ({myProjects.length})
                </h2>

                {myProjects.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                    <Briefcase size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Non sei ancora parte di nessun progetto.
                      Sfoglia il catalogo qui sotto per partecipare.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {myProjects.map(p => {
                      const isNew = !seenProjects.includes(p.id);
                      return (
                      <div key={p.id} className={`bg-white border rounded-lg p-5 hover:shadow-sm transition-shadow ${isNew ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-[#1a2744] truncate flex items-center gap-2">
                              {p.name}
                              {isNew && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider">
                                  ✨ Novità
                                </span>
                              )}
                            </h3>
                            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                {p.state || 'attivo'}
                              </span>
                              {p.owner_name && (
                                <span className="flex items-center gap-1">
                                  <User size={11} /> {p.owner_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {p.email_alias && (
                            <button
                              onClick={() => copyPublicLink(p.email_alias!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                              title={`Copia link pubblico: /p/${p.email_alias}`}
                            >
                              <Link2 size={12} /> Copia link pubblico
                            </button>
                          )}
                          <Link
                            href={`/consultant/partner-projects/${p.id}/playbook`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b]"
                          >
                            <FileText size={12} /> Apri playbook
                          </Link>
                        </div>
                      </div>
                    );})}
                  </div>
                )}
              </section>

              {/* ═══════════════════════════════════════════════════
                  SEZIONE 2 — CATALOGO (dove NON sono parte)
                  ═══════════════════════════════════════════════════ */}
              <section className="mb-10">
                <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
                  Catalogo disponibili ({catalog.length})
                </h2>

                {catalog.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                    <BookOpen size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Nessun progetto disponibile al momento.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {catalog.map(p => (
                      <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-[#1a2744] truncate">{p.pitchTitle}</h3>
                            {p.pitchTitle !== p.name && (
                              <div className="text-xs text-gray-400 mt-0.5">{p.name}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {p.funzioneProgetto && (
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                {p.funzioneProgetto.replace('_', ' ')}
                              </span>
                            )}
                            {p.ownerName && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <User size={12} /> {p.ownerName}
                              </span>
                            )}
                          </div>
                        </div>

                        {p.pitchSummary && (
                          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                            {p.pitchSummary}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-gray-400">
                            Pubblicato: {fmtDate(p.publishedAt)}
                          </div>
                          <div className="flex items-center gap-2">
                            {p.emailAlias && (
                              <Link
                                href={`/p/${p.emailAlias}`}
                                target="_blank"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 text-xs text-gray-700 font-semibold hover:bg-gray-50"
                              >
                                <ExternalLink size={12} /> Vedi pitch pubblico
                              </Link>
                            )}
                            {p.pendingRequestId ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-50 border border-amber-300 text-xs text-amber-800 font-semibold">
                                <Clock size={12} /> In attesa
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOpenRequest(p)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b]"
                              >
                                <Send size={12} /> Richiedi accesso
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ═══════════════════════════════════════════════════
                  SEZIONE 3 — LE MIE RICHIESTE
                  ═══════════════════════════════════════════════════ */}
              {myRequests.length > 0 && (
                <section>
                  <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
                    Le mie richieste ({myRequests.length})
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5">Progetto</th>
                          <th className="px-4 py-2.5">Stato</th>
                          <th className="px-4 py-2.5">Data</th>
                          <th className="px-4 py-2.5">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myRequests.map(r => {
                          const meta = STATE_META[r.state] || STATE_META.pending;
                          return (
                            <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-sm font-medium text-[#0f172a]">
                                {r.relationName}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
                                  <meta.Icon size={10} /> {meta.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-500">
                                {fmtDate(r.createDate)}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">
                                {r.state === 'rejected' && r.rejectedReason && (
                                  <span className="text-red-600">Motivo: {r.rejectedReason}</span>
                                )}
                                {r.state === 'approved' && r.approvedBy && (
                                  <span>Approvata da {r.approvedBy}</span>
                                )}
                                {r.state === 'pending' && 'In attesa di approvazione'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODALE RICHIESTA ACCESSO */}
      {requestModalOpen && requestProject && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !requestSending && setRequestModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#1a2744] mb-1">
              Richiedi accesso
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Progetto: <strong>{requestProject.pitchTitle}</strong>
            </p>

            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Perché vuoi partecipare? (opzionale)
            </label>
            <textarea
              value={requestMessage}
              onChange={e => setRequestMessage(e.target.value)}
              rows={4}
              placeholder="Es. ho contatti utili nel settore X, oppure esperienza su Y…"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none mb-4"
              disabled={requestSending}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRequestModalOpen(false)}
                disabled={requestSending}
                className="px-4 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSendRequest}
                disabled={requestSending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0f172a] text-white text-sm font-semibold hover:bg-[#1e293b] disabled:opacity-50"
              >
                {requestSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {requestSending ? 'Invio…' : 'Invia richiesta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
