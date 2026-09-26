"use client";
import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  CheckCircle2, Mail, Calculator, Landmark, FileText, Palette, Target,
  AlertTriangle, Brain, Shield, Package, UserCog, Phone, PenTool,
  Search, RefreshCw, Download, AlertCircle, ExternalLink, FileCheck2, FileX, Clock
} from "lucide-react";

type Doc = {
  id: number;
  name: string;
  status: string;
  templateId: number | null;
  templateCode: string | null;
  templateName: string | null;
  resModel: string | null;
  resId: number | null;
  projectId: number | null;
  projectName: string | null;
  partnerId: number | null;
  partnerName: string | null;
  hasPdf: boolean;
  pdfFilename: string | null;
  pageCount: number;
  createdAt: string;
  renderedAt: string | null;
  sentAt: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft:    { label: "Bozza",       color: "bg-gray-100 text-gray-700",     icon: FileText },
  ready:    { label: "Pronto",      color: "bg-blue-100 text-blue-800",     icon: FileCheck2 },
  rendered: { label: "Renderizzato", color: "bg-indigo-100 text-indigo-800", icon: FileText },
  sent:     { label: "Inviato",     color: "bg-amber-100 text-amber-800",   icon: Mail },
  error:    { label: "Errore",      color: "bg-red-100 text-red-800",       icon: FileX },
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
  if (days < 30) return `${days}g fa`;
  return `${Math.floor(days / 30)}mesi fa`;
}

export default function AdminDocumentiPage() {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Filtri
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");

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
      if (filterStatus) params.set("status", filterStatus);
      if (filterTemplate) params.set("templateCode", filterTemplate);
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", "200");

      const res = await fetch(`/api/admin/documents?${params.toString()}`, {
        headers: session?.token ? { Authorization: `JWT ${session.token}` } : {},
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Errore"); return; }
      setDocs(data.documents || []);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || "Errore di rete");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterTemplate]);

  const handleSearch = () => loadData();

  return (
    <AdminLayout
      title="Documenti"
      subtitle="Archivio di tutti i documenti generati"
      user={user}
      
    >
      <div className="p-8 max-w-7xl mx-auto">
          {/* KPI cards */}
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-1">
                <FileText size={16} className="text-gray-400" />
                <span className="text-[10px] text-gray-400">totali</span>
              </div>
              <div className="text-xl font-bold text-[#1a2744]">{Object.values(counts).reduce((s, n) => s + n, 0)}</div>
            </div>
            {(Object.keys(STATUS_META) as string[]).map((st) => {
              const meta = STATUS_META[st];
              const Icon = meta.icon;
              return (
                <div key={st} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Icon size={16} className="text-gray-400" />
                  </div>
                  <div className="text-xl font-bold text-[#1a2744]">{counts[st] || 0}</div>
                  <div className="text-[10px] text-gray-500">{meta.label}</div>
                </div>
              );
            })}
          </div>

          {/* Filtri */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-gray-400" />
              <input type="text" placeholder="Cerca per nome documento..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              <button onClick={handleSearch} className="px-3 py-2 bg-[#1a2744] text-white rounded-lg text-sm">Cerca</button>
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Tutti gli stati</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm max-w-[220px]">
              <option value="">Tutti i template</option>
              <option value="SPLIT-V6-001">Split V6</option>
              <option value="NDA-BASE-001">NDA Base</option>
              <option value="NDA-STD-001">NDA Standard</option>
              <option value="CONTRACT-SVC-001">Contratto Servizio</option>
              <option value="CONTRATTO-CONSULENZA-001">Contratto Consulenza</option>
              <option value="PROMESSA-PAGAMENTO-001">Promessa Pagamento</option>
              <option value="BP-STD-001">Business Plan Standard</option>
              <option value="BP-BASE-001">Business Plan Base</option>
              <option value="PROP-L2-001">Proposta L2</option>
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
            ) : docs.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Nessun documento trovato</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Documento</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Progetto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stato</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => {
                    const st = STATUS_META[doc.status] || { label: doc.status, color: "bg-gray-100 text-gray-700", icon: FileText };
                    const Icon = st.icon;
                    return (
                      <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[280px] truncate" title={doc.name}>
                          {doc.name}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                            {doc.templateCode || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {doc.projectId ? (
                            <Link href={`/admin/partner-projects/${doc.projectId}`} className="text-[#0f3460] hover:underline">
                              {doc.projectName || `#${doc.projectId}`}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">{doc.partnerName || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                            <Icon size={12} /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {etaLabel(doc.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {doc.hasPdf ? (
                            <a href={`/api/admin/documents/${doc.id}/download`}
                              className="inline-flex items-center gap-1 text-xs text-[#0f3460] hover:underline">
                              <Download size={12} /> PDF
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-400">PDF assente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-400 text-center">
            Mostrati {docs.length} di {total}
          </div>
      </div>
    </AdminLayout>
  );
}