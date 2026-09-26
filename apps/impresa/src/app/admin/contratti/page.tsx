"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  CheckCircle2, Mail, Calculator, Landmark, FileText, Palette, Target,
  AlertTriangle, Brain, Shield, Package, UserCog, Phone, PenTool,
  Search, RefreshCw, AlertCircle, Code2, Plus, FileSignature,
  Clock, Download, Eye, Edit
} from "lucide-react";

type Contract = {
  id: number;
  name: string;
  state: string;
  templateId: number | null;
  templateCode: string | null;
  templateName: string | null;
  projectId: number | null;
  projectName: string | null;
  counterpartyId: number | null;
  counterpartyName: string | null;
  pdfMode: string;
  revision: number;
  hasPdf: boolean;
  createdAt: string;
  lastGeneratedAt: string | null;
};

const STATE_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "Bozza",           color: "bg-gray-100 text-gray-700" },
  generated: { label: "PDF Generato",    color: "bg-blue-100 text-blue-800" },
  sent:      { label: "Inviato",         color: "bg-amber-100 text-amber-800" },
  signed:    { label: "Firmato",         color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annullato",       color: "bg-gray-100 text-gray-500" },
};

function etaLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

export default function AdminContrattiPage() {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("");

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) { window.location.href = "/login"; return; }
    const u = JSON.parse(session);
    setUser(u);
    loadData(u);
  }, []);

  const loadData = async (u?: any) => {
    const session = u || user;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filterState) params.set("state", filterState);
      const res = await fetch(`/api/admin/contracts?${params.toString()}`, {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Errore"); return; }
      setContracts(data.contracts || []);
    } catch (e: any) {
      setError(e.message || "Errore di rete");
    } finally { setLoading(false); }
  };

  const handleSearch = () => loadData();

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
    { icon: FileText, label: "Documenti", href: "/admin/documenti" },
    { icon: Code2, label: "Template", href: "/admin/template" },
    { icon: FileSignature, label: "Contratti", href: "/admin/contratti" },
    { icon: UserCog, label: "Team", href: "/admin/team" },
    { icon: Phone, label: "Call Prenotate", href: "/admin/bookings" },
    { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
    { icon: Users, label: "Coda Lead", href: "/admin/leads" },
    { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
    { icon: Landmark, label: "Commissioni", href: "/admin/accounting" },
    { icon: Mail, label: "La mia email", href: "/admin/mia-email" },
    { icon: Brain, label: "Knowledge Base", href: "/admin/kb" },
    { icon: Shield, label: "Sicurezza", href: "/admin/security" },
    { icon: Settings, label: "Impostazioni", href: "/admin/settings/system" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
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
            const isActive = typeof window !== "undefined" && window.location.pathname.startsWith(item.href) && (item.href !== "/admin/dashboard" || window.location.pathname === item.href);
            return (
              <Link key={i} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-[#1a2744] text-white shadow-lg shadow-blue-900/20" : "text-gray-600 hover:bg-gray-100"}`}>
                <item.icon size={18} /> {item.label}
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

      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2744]">Contratti</h1>
            <p className="text-sm text-gray-500">Composer documenti e firme</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => loadData()} className="p-2 rounded-lg hover:bg-gray-100">
              <RefreshCw size={18} className={loading ? "animate-spin text-gray-400" : "text-gray-600"} />
            </button>
            <Link href="/admin/contratti/nuovo"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460]">
              <Plus size={16} /> Nuovo contratto
            </Link>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-gray-400" />
              <input type="text" placeholder="Cerca per titolo..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
            </div>
            <select value={filterState} onChange={(e) => setFilterState(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Tutti gli stati</option>
              {Object.entries(STATE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={handleSearch} className="px-3 py-2 bg-[#1a2744] text-white rounded-lg text-sm">Filtra</button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Caricamento…</div>
            ) : contracts.length === 0 ? (
              <div className="p-12 text-center">
                <FileSignature size={48} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">Nessun contratto. Creane uno nuovo per iniziare.</p>
                <Link href="/admin/contratti/nuovo"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460]">
                  <Plus size={16} /> Nuovo contratto
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Titolo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Template</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Progetto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Controparte</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stato</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aggiornato</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const meta = STATE_META[c.state] || { label: c.state, color: "bg-gray-100" };
                    const refDate = c.lastGeneratedAt || c.createdAt;
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-[#1a2744] max-w-[250px] truncate" title={c.name}>
                          {c.name}
                          {c.pdfMode === 'preview' && <span className="ml-2 text-xs text-amber-600">(anteprima)</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{c.templateCode || "—"}</td>
                        <td className="px-4 py-3 text-sm">{c.projectName || "—"}</td>
                        <td className="px-4 py-3 text-sm">{c.counterpartyName || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
                            {meta.label} {c.revision > 1 && `· r${c.revision}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{etaLabel(refDate)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/contratti/${c.id}`}
                            className="inline-flex items-center gap-1 text-xs text-[#0f3460] hover:underline">
                            <Edit size={12} /> Apri
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
