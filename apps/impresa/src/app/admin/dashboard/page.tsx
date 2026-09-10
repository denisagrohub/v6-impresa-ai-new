"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, CheckCircle2, Mail, Users,
  Settings, LogOut, TrendingUp, Clock, FileText, Building2,
  Briefcase, Landmark, Palette, Target, Server, Calculator,
  AlertTriangle, Brain, Shield, Key, Plus, Package, UserCog, Phone
} from "lucide-react";
import { OdooStatus } from "@/components/admin/OdooStatus";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    projects: 0,
    partnershipProjects: 0,
    kbRequests: 0,
    certifiedDocs: 0,
    consultants: 0,
    clients: 0,
    modulesActive: 0,
    auditLogCount: 0,
  });
  const [newCounts, setNewCounts] = useState({
    projects: 0,
    partnershipProjects: 0,
    kbRequests: 0,
    certifiedDocs: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [candidacies, setCandidacies] = useState<any[]>([]);
  const [candidacyActionId, setCandidacyActionId] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(session));
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-stats');
      const data = await res.json();

      if (!data.success) {
        setDataError(data.error || 'Odoo non raggiungibile');
        return;
      }

      setStats(data.stats);
      setNewCounts(data.newCounts || { projects: 0, partnershipProjects: 0, kbRequests: 0, certifiedDocs: 0 });
      setRecentActivities(data.recentActivities || []);
      setCandidacies(data.candidacies || []);
    } catch (error: any) {
      console.error('Errore caricamento dashboard:', error);
      setDataError(error.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProjectFromCandidacy = async (candidacyId: number) => {
    setCandidacyActionId(candidacyId);
    try {
      const res = await fetch(`/api/admin/candidacies/${candidacyId}/create-project`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        router.push(`/admin/partner-projects/${data.projectId}`);
      } else {
        alert(data.error || 'Creazione fallita');
      }
    } finally {
      setCandidacyActionId(null);
    }
  };

  const handleDeleteCandidacy = async (candidacyId: number) => {
    if (!confirm('Eliminare questa candidatura? Non si può annullare.')) return;
    setCandidacyActionId(candidacyId);
    try {
      const res = await fetch(`/api/admin/candidacies/${candidacyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCandidacies((prev) => prev.filter((c) => c.id !== candidacyId));
      } else {
        alert(data.error || 'Eliminazione fallita');
      }
    } finally {
      setCandidacyActionId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pi_session");
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: FolderKanban, label: "Progetti", href: "/admin/projects" },
    { icon: Users, label: "Progetti Partner", href: "/admin/partner-projects" },
    { icon: UserCog, label: "Team (Consulenti/Referral/Slot)", href: "/admin/team" },
    { icon: Phone, label: "Call Prenotate", href: "/admin/bookings" },
    { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
    { icon: Users, label: "Coda Lead", href: "/admin/leads" },

    { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
    { icon: Landmark, label: "Commissioni", href: "/admin/accounting" },
    { icon: FileText, label: "Contratti", href: "/admin/contracts" },
    { icon: Mail, label: "Email", href: "/admin/email" },

    { icon: Brain, label: "Knowledge Base", href: "/admin/kb" },
    { icon: FileText, label: "Libreria", href: "/admin/library" },
    { icon: Palette, label: "Brand Projects", href: "/admin/brand" },
    { icon: TrendingUp, label: "Marketing Plans", href: "/admin/marketing" },
    { icon: Shield, label: "Sicurezza", href: "/admin/security" },
    { icon: Settings, label: "Impostazioni", href: "/admin/settings/system" },
    { icon: AlertTriangle, label: "Richieste", href: "/admin/requests" },
    { icon: Package, label: "Prodotti Custom", href: "/admin/products" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

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
            const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;
            return (
              <Link key={i} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-[#1a2744] text-white shadow-lg shadow-blue-900/20' : 'text-gray-600 hover:bg-gray-100'}`}>
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
            <h1 className="text-2xl font-bold text-[#1a2744]">Dashboard</h1>
            <p className="text-sm text-gray-500">Panoramica del sistema V6</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-[#1a2744]">{user?.name || 'Admin'}</div>
              <div className="text-xs text-gray-500">{user?.email || 'admin@v6impresa.it'}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shadow-md">A</div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-6">
            <OdooStatus />
          </div>

          {dataError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Dati non aggiornati: {dataError}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link href="/admin/projects" className={`block bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow ${newCounts.projects > 0 ? 'blink-alert-border' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center"><FolderKanban size={24} className="text-blue-600" /></div>
                {newCounts.projects > 0 && <span className="text-xs font-bold text-red-600">{newCounts.projects} da decidere</span>}
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.projects}</div>
              <div className="text-sm text-gray-500">Progetti Totali</div>
            </Link>
            <a href="#candidature-partnership" className={`block bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow ${newCounts.partnershipProjects > 0 ? 'blink-alert-border' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center"><Users size={24} className="text-orange-600" /></div>
                {newCounts.partnershipProjects > 0 && <span className="text-xs font-bold text-red-600">{newCounts.partnershipProjects} nuove</span>}
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.partnershipProjects}</div>
              <div className="text-sm text-gray-500">Partnership Projects</div>
            </a>
            <Link href="/admin/kb" className={`block bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow ${newCounts.kbRequests > 0 ? 'blink-alert-border' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center"><Brain size={24} className="text-purple-600" /></div>
                {newCounts.kbRequests > 0 && <span className="text-xs font-bold text-red-600">{newCounts.kbRequests} in attesa</span>}
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.kbRequests}</div>
              <div className="text-sm text-gray-500">Richieste KB</div>
            </Link>
            <Link href="/admin/library" className={`block bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow ${newCounts.certifiedDocs > 0 ? 'blink-alert-border' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center"><Shield size={24} className="text-green-600" /></div>
                {newCounts.certifiedDocs > 0 && <span className="text-xs font-bold text-red-600">{newCounts.certifiedDocs} nuovi</span>}
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.certifiedDocs}</div>
              <div className="text-sm text-gray-500">Documenti Certificati</div>
            </Link>
          </div>

          <style jsx global>{`
            @keyframes blink-alert-border {
              0%, 100% { border-color: rgb(239 68 68); box-shadow: 0 0 0 1px rgb(239 68 68 / 0.3); }
              50% { border-color: rgb(254 202 202); box-shadow: 0 0 0 1px transparent; }
            }
            .blink-alert-border {
              border-width: 2px;
              animation: blink-alert-border 1.2s ease-in-out infinite;
            }
          `}</style>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-[#1a2744] mb-4">🔐 Stato Sistema</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-700">🔵 Moduli V6 attivi</span>
                  <span className="text-xs text-blue-600">{stats.modulesActive}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span className="text-sm font-medium text-yellow-700">🟡 Audit log (eventi produzione)</span>
                  <span className="text-xs text-yellow-600">{stats.auditLogCount.toLocaleString('it-IT')} operazioni</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium text-purple-700">👤 Consulenti</span>
                  <span className="text-xs text-purple-600">{stats.consultants}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">🟢 Clienti collegati</span>
                  <span className="text-xs text-green-600">{stats.clients}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-[#1a2744] mb-4">📌 Attività Recenti</h2>
              <div className="space-y-3">
                {recentActivities.length === 0 && (
                  <div className="text-sm text-gray-400">Nessuna attività registrata.</div>
                )}
                {recentActivities.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg">{act.icon}</div>
                    <div className="flex-1">
                      <span className="text-sm">{act.title}</span>
                      <div className="text-xs text-gray-400">{act.time ? new Date(act.time).toLocaleString('it-IT') : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div id="candidature-partnership" className="bg-white rounded-2xl border border-gray-100 p-6 scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1a2744]">🤝 Candidature Partnership</h2>
              <span className="text-xs text-gray-400">{candidacies.length} totali</span>
            </div>
            {candidacies.length === 0 ? (
              <div className="text-sm text-gray-400">Nessuna candidatura ricevuta finora.</div>
            ) : (
              <div className="space-y-2">
                {candidacies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-[#1a2744]">{c.company_name || c.name}</div>
                      <div className="text-xs text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{c.state}</span>
                      <span className="text-xs text-gray-400">{c.create_date ? new Date(c.create_date).toLocaleDateString('it-IT') : ''}</span>
                      <button
                        onClick={() => handleCreateProjectFromCandidacy(c.id)}
                        disabled={candidacyActionId === c.id}
                        className="text-xs px-2 py-1 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] disabled:opacity-50"
                      >
                        Crea Progetto Partner
                      </button>
                      <button
                        onClick={() => handleDeleteCandidacy(c.id)}
                        disabled={candidacyActionId === c.id}
                        className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
