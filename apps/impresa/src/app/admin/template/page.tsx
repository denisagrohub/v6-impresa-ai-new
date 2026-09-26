"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  CheckCircle2, Mail, Calculator, Landmark, FileText, Palette, Target,
  AlertTriangle, Brain, Shield, Package, UserCog, Phone, PenTool,
  Search, RefreshCw, AlertCircle, Code2, ExternalLink
} from "lucide-react";

type Template = {
  id: number;
  code: string;
  name: string;
  version: string;
  category: string | null;
  description: string | null;
  active: boolean;
  usageCount: number;
  lastUsed: string | null;
  hasSource: boolean;
  hasDraft: boolean;
  sourcePromotedAt: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business",
  legal: "Legale",
  contract: "Contratto",
  report: "Report",
  marketing: "Marketing",
  internal: "Interno",
  other: "Altro",
};

export default function AdminTemplatePage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterHasSource, setFilterHasSource] = useState<string>("");

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
      const res = await fetch(`/api/admin/templates?${params.toString()}`, {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Errore"); return; }
      let list = data.templates || [];
      if (filterHasSource === "yes") list = list.filter((t: Template) => t.hasSource);
      if (filterHasSource === "no") list = list.filter((t: Template) => !t.hasSource);
      setTemplates(list);
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
            <h1 className="text-2xl font-bold text-[#1a2744]">Template Typst</h1>
            <p className="text-sm text-gray-500">Editor e sorgenti dei template documentali</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => loadData()} className="p-2 rounded-lg hover:bg-gray-100" title="Ricarica">
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
          {/* KPI */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <Code2 size={20} className="text-indigo-500" />
                <span className="text-xs text-gray-400">totali</span>
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">{templates.length}</div>
              <div className="text-xs text-gray-500">Template registrati</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 size={20} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">{templates.filter(t => t.hasSource).length}</div>
              <div className="text-xs text-gray-500">Con sorgente</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle size={20} className="text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-[#1a2744]">{templates.filter(t => !t.hasSource).length}</div>
              <div className="text-xs text-gray-500">Senza sorgente</div>
            </div>
          </div>

          {/* Filtri */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-gray-400" />
              <input type="text" placeholder="Cerca per codice o nome..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              <button onClick={handleSearch} className="px-3 py-2 bg-[#1a2744] text-white rounded-lg text-sm">Cerca</button>
            </div>
            <select value={filterHasSource} onChange={(e) => setFilterHasSource(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Tutti</option>
              <option value="yes">Con sorgente</option>
              <option value="no">Senza sorgente</option>
            </select>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Tabella */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Caricamento…</div>
            ) : templates.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Nessun template trovato</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Codice</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Versione</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sorgente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usi</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{t.code}</td>
                      <td className="px-4 py-3 text-sm">{t.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {t.category ? (CATEGORY_LABELS[t.category] || t.category) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{t.version}</td>
                      <td className="px-4 py-3">
                        {t.hasSource ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                            <CheckCircle2 size={12} /> Sì
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                            <AlertCircle size={12} /> No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{t.usageCount}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/template/${t.code}`}
                          className="inline-flex items-center gap-1 text-xs text-[#0f3460] hover:underline">
                          <PenTool size={12} /> Apri editor
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
