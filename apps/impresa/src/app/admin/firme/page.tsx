"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  CheckCircle2, Mail, Calculator, Landmark, FileText, Building2,
  Briefcase, Landmark as LandmarkIcon, Palette, Target, Server,
  AlertTriangle, Brain, Shield, Plus, Package, UserCog, Phone,
  PenTool, Clock, Eye, XCircle, CheckCircle, AlertCircle, RefreshCw,
  Send, Ban, ExternalLink, Search, Filter
} from "lucide-react";

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

  const handleLogout = () => {
    localStorage.removeItem("pi_session");
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: FolderKanban, label: "Progetti", href: "/admin/projects" },
    { icon: Users, label: "Progetti Partner", href: "/admin/partner-projects" },
    { icon: PenTool, label: "Firme", href: "/admin/firme" },
    { icon: UserCog, label: "Team (Consulenti/Referral/Slot)", href: "/admin/team" },
    { icon: Phone, label: "Call Prenotate", href: "/admin/bookings" },
    { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
    { icon: Users, label: "Coda Lead", href: "/admin/leads" },
    { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
    { icon: Landmark, label: "Commissioni", href: "/admin/accounting" },
    { icon: FileText, label: "Contratti", href: "/admin/contracts" },
    { icon: Mail, label: "La mia email", href: "/admin/mia-email" },
    { icon: Mail, label: "Email funnel", href: "/admin/email" },
    { icon: FileText, label: "Blog", href: "/admin/blog" },
    { icon: Users, label: "Candidature", href: "/admin/candidature" },
    { icon: Brain, label: "Knowledge Base", href: "/admin/kb" },
    { icon: FileText, label: "Libreria", href: "/admin/library" },
    { icon: Palette, label: "Brand Projects", href: "/admin/brand" },
    { icon: Target, label: "Marketing Plans", href: "/admin/marketing" },
    { icon: Shield, label: "Sicurezza", href: "/admin/security" },
    { icon: Settings, label: "Impostazioni", href: "/admin/settings/system" },
    { icon: AlertTriangle, label: "Richieste", href: "/admin/requests" },
    { icon: Package, label: "Prodotti Custom", href: "/admin/products" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center text-white font-bold">PI</div>
            <div>
              <div className="font-bold text-[#1a2744]">V6 Impresa AI</div>
              <div className="text-xs text-gray-500">Admin Panel</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, i) => {
            const isActive = typeof window !== "undefined" && window.location.pathname === item.href;
            return (
              <Link key={i} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-[#1a2744] text-white shadow-lg shadow-blue-900/20" : "text-gray-600 hover:bg-gray-100"}`}>
                <item.icon size={18} /> {item.label}
                {item.href === "/admin/firme" && (counts.sent || 0) + (counts.viewed || 0) > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                    {(counts.sent || 0) + (counts.viewed || 0)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full">
            <LogOut size={18} /> Esci
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2744]">Firme</h1>
            <p className="text-sm text-gray-500">Tutte le richieste di firma della piattaforma</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100" title="Ricarica">
              <RefreshCw size={18} className={loading ? "animate-spin text-gray-400" : "text-gray-600"} />
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-[#1a2744]">{user?.name || "Admin"}</div>
              <div className="text-xs text-gray-500">{user?.email || ""}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shadow-md">A</div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
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
        </div>
      </div>
    </div>
  );
}
