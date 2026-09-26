"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/layout/AdminLayout";
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

  return (
    <AdminLayout
      title="Template Typst"
      subtitle="Editor e sorgenti dei template documentali"
      user={user}
      
    >
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
    </AdminLayout>
  );
}