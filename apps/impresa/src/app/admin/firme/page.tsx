"use client";
import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import Link from "next/link";
import { LayoutDashboard, FolderKanban, Users, Settings, LogOut, CheckCircle2, Mail, Calculator, Landmark, FileText, Building2, Briefcase, Landmark as LandmarkIcon, Palette, Target, Server, AlertTriangle, Brain, Shield, Plus, Package, UserCog, Phone, PenTool, Clock, Eye, XCircle, CheckCircle, AlertCircle, RefreshCw, Send, Ban, ExternalLink, Search, Filter, FileSignature, Loader2 } from "lucide-react";

type SignRequest = {
  id: number;
  name: string;
  kind: string | null;
  status: string;
  externalId: string | null;
  requestUrl: string | null;
  partnerId: number | null;
  partnerName: string | null;
  projectId: number | null;
  projectName: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
};

const KIND_LABELS: Record<string, string> = {
  split_v6: "Split V6",
  nda: "NDA",
  ncnd: "NCND",
  contratto: "Contratto",
  referral: "Referral",
  altro: "Altro",
};

// 30/09/2026 (P2): colori/label stato deal (per la Vista deal)
const stateColor: Record<string, string> = {
    forecasting: 'bg-gray-100 text-gray-700',
    negotiating: 'bg-blue-100 text-blue-700',
    frozen: 'bg-cyan-100 text-cyan-700',
    signing: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-700',
};

const stateLabel: Record<string, string> = {
    forecasting: 'Previsione',
    negotiating: 'In trattativa',
    frozen: 'Congelato',
    signing: 'In firma',
    active: 'Attivo',
    closed: 'Chiuso',
    cancelled: 'Annullato',
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: "In attesa dati", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  sent:      { label: "Inviata",   color: "bg-amber-100 text-amber-800",   icon: Send },
  viewed:    { label: "Vista",     color: "bg-blue-100 text-blue-800",     icon: Eye },
  signed:    { label: "Firmata",   color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  rejected:  { label: "Rifiutata", color: "bg-red-100 text-red-800",       icon: XCircle },
  expired:   { label: "Scaduta",   color: "bg-orange-100 text-orange-800", icon: Clock },
  cancelled: { label: "Annullata", color: "bg-gray-100 text-gray-500",     icon: Ban },
};

function etaLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g fa`;
  const months = Math.floor(days / 30);
  return `${months}mesi fa`;
}

function isStale(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  return Date.now() - d.getTime() > 3 * 24 * 60 * 60 * 1000; // >3 giorni
}

export default function AdminFirmePage() {
  const [loading, setLoading] = useState(true);
  const [signRequests, setSignRequests] = useState<SignRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // 30/09/2026 (P2): tab switch Firme | Vista deal
  const [activeView, setActiveView] = useState<'firme' | 'deal'>('firme');
  const [dealChecklists, setDealChecklists] = useState<any[]>([]);
  const [dealChecklistsLoading, setDealChecklistsLoading] = useState(false);
  const [dealChecklistsError, setDealChecklistsError] = useState<string | null>(null);

  const loadDealChecklists = async () => {
    setDealChecklistsLoading(true);
    setDealChecklistsError(null);
    try {
      const raw = localStorage.getItem('pi_session');
      const session = raw ? JSON.parse(raw) : null;
      const token = session?.token;
      if (!token) throw new Error('Sessione mancante');
      const r = await fetch('/api/admin/deal-checklists', {
        headers: { Authorization: `JWT ${token}` },
      });
      const json = await r.json();
      if (!r.ok || !json.success) throw new Error(json.error || 'Errore');
      setDealChecklists(json.deals || []);
    } catch (e: any) {
      setDealChecklistsError(e.message);
      setDealChecklists([]);
    } finally {
      setDealChecklistsLoading(false);
    }
  };

  // Filtri
  const [filterStatus, setFilterStatus] = useState<string>("");  // "" = default (no cancelled)
  const [filterKind, setFilterKind] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(session));
    loadData();
  }, []);

  // 30/09/2026 (P2): carica deal-checklists quando si passa alla vista deal
  useEffect(() => {
    if (activeView === 'deal') {
      loadDealChecklists();
    }
  }, [activeView]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterKind) params.set("kind", filterKind);
      params.set("limit", "200");

      const res = await fetch(`/api/admin/sign-requests?${params.toString()}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Errore caricamento");
        return;
      }
      let list = data.signRequests || [];
      if (!showCancelled) {
        list = list.filter((sr: SignRequest) => sr.status !== "cancelled");
      }
      setSignRequests(list);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || "Errore di rete");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterKind, showCancelled]);

  const filtered = useMemo(() => {
    if (!search.trim()) return signRequests;
    const s = search.toLowerCase();
    return signRequests.filter((sr) =>
      (sr.partnerName || "").toLowerCase().includes(s) ||
      (sr.projectName || "").toLowerCase().includes(s) ||
      (sr.name || "").toLowerCase().includes(s)
    );
  }, [signRequests, search]);

  return (
    <AdminLayout
      title="Firme"
      subtitle="Tutte le richieste di firma della piattaforma"
      user={user}
      badges={[{ href: '/admin/firme', count: (counts.sent || 0) + (counts.viewed || 0), color: 'bg-amber-500' }]}
      actions={
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100" title="Ricarica">
          <RefreshCw size={18} className={loading ? "animate-spin text-gray-400" : "text-gray-600"} />
        </button>
      }
    >
      <div className="p-8 max-w-7xl mx-auto">

          {/* 30/09/2026 (P2): tab switch Firme | Vista deal */}
          <div className="mb-6 inline-flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setActiveView('firme')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === 'firme' ? 'bg-white text-[#1a2744] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FileSignature size={14} /> Firme
              </span>
            </button>
            <button
              onClick={() => setActiveView('deal')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === 'deal' ? 'bg-white text-[#1a2744] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FolderKanban size={14} /> Vista deal
                {dealChecklists.length > 0 && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                    {dealChecklists.length}
                  </span>
                )}
              </span>
            </button>
          </div>

          {activeView === 'firme' && (
          <>
          {/* KPI cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <Send size={20} className="text-amber-500" />
                <span className="text-xs text-gray-400">in attesa</span>
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">{(counts.sent || 0) + (counts.viewed || 0)}</div>
              <div className="text-xs text-gray-500">Inviate / Viste</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle size={20} className="text-emerald-500" />
                <span className="text-xs text-gray-400">firmate</span>
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">{counts.signed || 0}</div>
              <div className="text-xs text-gray-500">Completate</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <XCircle size={20} className="text-red-500" />
                <span className="text-xs text-gray-400">rifiutate</span>
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">{(counts.rejected || 0) + (counts.expired || 0)}</div>
              <div className="text-xs text-gray-500">Rifiutate / Scadute</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <FileText size={20} className="text-gray-400" />
                <span className="text-xs text-gray-400">totali</span>
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">
                {Object.values(counts).reduce((s, n) => s + n, 0)}
              </div>
              <div className="text-xs text-gray-500">Tutte</div>
            </div>
          </div>

          {/* Filtri */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                placeholder="Cerca per firmatario, progetto, titolo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Tutte (tranne annullate)</option>
              <option value="sent,viewed">Solo in attesa</option>
              <option value="signed">Solo firmate</option>
              <option value="rejected,expired">Solo rifiutate/scadute</option>
            </select>
            <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Tutti i tipi</option>
              <option value="split_v6">Split V6</option>
              <option value="nda">NDA</option>
              <option value="ncnd">NCND</option>
              <option value="contratto">Contratto</option>
              <option value="referral">Referral</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              Mostra annullate
            </label>
          </div>

          {/* Errore */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Tabella */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Caricamento…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Nessuna firma trovata</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Titolo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Progetto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Firmatario</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stato</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Età</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sr) => {
                    const st = STATUS_LABELS[sr.status] || { label: sr.status, color: "bg-gray-100 text-gray-700", icon: FileText };
                    const Icon = st.icon;
                    const stale = isStale(sr.sentAt || sr.createdAt) && (sr.status === "sent" || sr.status === "viewed");
                    const refDate = sr.signedAt || sr.sentAt || sr.createdAt;
                    return (
                      <tr key={sr.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${stale ? "bg-amber-50/30" : ""}`}>
                        <td className="px-4 py-3 text-sm">{KIND_LABELS[sr.kind || ""] || sr.kind || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[280px] truncate" title={sr.name}>
                          {sr.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {sr.projectId ? (
                            <Link href={`/admin/partner-projects/${sr.projectId}`} className="text-[#0f3460] hover:underline">
                              {sr.projectName || `#${sr.projectId}`}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {sr.partnerName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                            <Icon size={12} /> {st.label}
                          </span>
                          {sr.status === "draft" && sr.notes && (
                            <span className="ml-2 text-[10px] text-yellow-700">{sr.notes}</span>
                          )}
                          {stale && <span className="ml-2 text-[10px] text-amber-600 font-semibold">ferma da giorni</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500" title={refDate ? new Date(refDate.replace(" ", "T") + "Z").toLocaleString("it-IT") : ""}>
                          {etaLabel(refDate)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sr.requestUrl ? (
                            <a href={sr.requestUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#0f3460] hover:underline mr-3">
                              <ExternalLink size={12} /> Apri
                            </a>
                          ) : null}
                          {sr.projectId ? (
                            <Link href={`/admin/partner-projects/${sr.projectId}`}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline">
                              Vedi progetto
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-400 text-center">
            Mostrate {filtered.length} di {total} firme
          </div>
          </>
          )}

          {activeView === 'deal' && (
            <>
              {dealChecklistsError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} /> {dealChecklistsError}
                </div>
              )}

              {dealChecklistsLoading && (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Carico checklist deal…
                </div>
              )}

              {!dealChecklistsLoading && dealChecklists.length === 0 && !dealChecklistsError && (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                  Nessun deal con checklist attiva.
                </div>
              )}

              {!dealChecklistsLoading && dealChecklists.map((deal: any) => {
                const pct = deal.progress?.pct || 0;
                const blocked = deal.steps?.filter((s: any) => s.isBlocking).length || 0;
                return (
                  <div key={deal.dealId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-transparent border-b border-gray-100">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <Link href={`/admin/deals/${deal.dealId}`} className="font-bold text-[#1a2744] hover:underline truncate">
                            {deal.dealName}
                          </Link>
                          {deal.dealState && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${stateColor[deal.dealState] || 'bg-gray-100'}`}>
                              {stateLabel[deal.dealState] || deal.dealState}
                            </span>
                          )}
                          {deal.relationName && (
                            <span className="text-xs text-gray-400 hidden md:inline truncate">
                              · {deal.relationName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {blocked > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              {blocked} blocking
                            </span>
                          )}
                          <div className="text-xs text-gray-500">
                            <span className="font-bold text-[#1a2744]">{deal.progress.done}</span>/{deal.progress.total}
                          </div>
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                blocked > 0 ? 'bg-gradient-to-r from-blue-500 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-emerald-600">{pct}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-1.5">
                      {deal.steps.map((step: any) => {
                        const isDone = step.status === 'done';
                        const isReady = step.isReady && !isDone;
                        const isLocked = !isReady && !isDone;
                        const sr = step.signRequest;
                        return (
                          <div
                            key={step.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                              isDone ? 'bg-emerald-50/50' :
                              isReady ? 'bg-amber-50 border border-amber-200' :
                              'bg-gray-50/50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              isDone ? 'bg-emerald-500 text-white' :
                              isReady ? 'bg-amber-500 text-white' :
                              'bg-gray-200 text-gray-400'
                            }`}>
                              {isDone ? '✓' : isReady ? '!' : '🔒'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-semibold ${isDone ? 'text-gray-500' : 'text-[#1a2744]'}`}>
                                {step.label}
                              </div>
                              {isLocked && step.requiresCodes && (
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                  Si sblocca dopo: {step.requiresCodes.replace(/_/g, ' ')}
                                </div>
                              )}
                              {isDone && sr?.signedAt && (
                                <div className="text-[11px] text-emerald-600 mt-0.5">
                                  Firmato il {new Date(sr.signedAt).toLocaleDateString('it-IT')}
                                  {sr.partnerName && <span className="text-gray-400"> · {sr.partnerName}</span>}
                                </div>
                              )}
                              {isReady && sr && (sr.status === 'sent' || sr.status === 'viewed') && (
                                <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                                  In attesa di firma{sr.partnerName && ` · ${sr.partnerName}`}
                                </div>
                              )}
                            </div>
                            {isReady && sr?.requestUrl && (sr.status === 'sent' || sr.status === 'viewed' || sr.status === 'draft') && (
                              <a
                                href={sr.requestUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 shrink-0"
                              >
                                <PenTool size={12} /> Apri
                              </a>
                            )}
                            {isDone && (
                              <span className="text-[10px] text-emerald-600 font-medium shrink-0 uppercase tracking-wider">
                                OK
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
      </div>
    </AdminLayout>
  );
}
