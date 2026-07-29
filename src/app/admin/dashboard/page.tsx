"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, CheckCircle2, Mail, Users,
  Settings, LogOut, TrendingUp, Clock, FileText, Building2,
  Briefcase, Landmark, Palette, Target, Server, Calculator,
  AlertTriangle, DollarSign, Brain, Shield, Key, Plus, Package
} from "lucide-react";
import { OdooStatus } from "@/components/admin/OdooStatus";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    projects: 0,
    brandProjects: 0,
    marketingPlans: 0,
    kbRequests: 0,
    certifiedDocs: 0,
    consultants: 0,
    clients: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) {
      window.location.href = "/admin/login";
      return;
    }
    setUser(JSON.parse(session));
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [projectsRes, partnersRes] = await Promise.all([
        fetch('/api/admin/projects'),
        fetch('/api/admin/partners'),
      ]);

      const projects = await projectsRes.json();
      const partners = await partnersRes.json();

      setStats({
        projects: projects.projects?.length || 0,
        brandProjects: 0,
        marketingPlans: 0,
        kbRequests: 0,
        certifiedDocs: 0,
        consultants: partners.partners?.filter((p: any) => p.type === 'consultant').length || 0,
        clients: projects.projects?.filter((p: any) => p.cliente).length || 0,
      });

      setRecentActivities([
        { type: 'system', icon: '🔵', title: 'Dashboard caricata', time: 'ora' },
      ]);

    } catch (error) {
      console.error('Errore caricamento dashboard:', error);
    } finally {
      setLoading(false);
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
    { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
    { icon: Users, label: "Coda Lead", href: "/admin/leads" },

    { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
    { icon: Landmark, label: "Contabilità", href: "/admin/accounting" },
    { icon: Mail, label: "Email", href: "/admin/email" },

    { icon: Brain, label: "Knowledge Base", href: "/admin/kb" },
    { icon: FileText, label: "Libreria", href: "/admin/library" },
    { icon: Palette, label: "Brand Projects", href: "/admin/brand" },
    { icon: TrendingUp, label: "Marketing Plans", href: "/admin/marketing" },
    { icon: Shield, label: "Sicurezza", href: "/admin/security" },
    { icon: DollarSign, label: "Pagamenti", href: "/admin/payments" },
main
    { icon: Users, label: "Partner", href: "/admin/partners" },
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
          <div className="mt-2 text-xs text-green-600">
            🔵 Odoo: {process.env.NEXT_PUBLIC_USE_ODOO === 'true' ? 'Connesso' : 'Mock'}
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center"><FolderKanban size={24} className="text-blue-600" /></div>
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.projects}</div>
              <div className="text-sm text-gray-500">Progetti Totali</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center"><Palette size={24} className="text-orange-600" /></div>
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.brandProjects}</div>
              <div className="text-sm text-gray-500">Brand Projects</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center"><Brain size={24} className="text-purple-600" /></div>
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.kbRequests}</div>
              <div className="text-sm text-gray-500">Richieste KB</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center"><Shield size={24} className="text-green-600" /></div>
              </div>
              <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.certifiedDocs}</div>
              <div className="text-sm text-gray-500">Documenti Certificati</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-[#1a2744] mb-4">🔐 Stato Sistema</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">🟢 Odoo</span>
                  <span className="text-xs text-green-600">{process.env.NEXT_PUBLIC_USE_ODOO === 'true' ? 'Connesso' : 'Mock'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-700">🔵 Moduli V6</span>
                  <span className="text-xs text-blue-600">✅ 17 attivi</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span className="text-sm font-medium text-yellow-700">🟡 Audit log</span>
                  <span className="text-xs text-yellow-600">1.256 operazioni</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-[#1a2744] mb-4">📌 Attività Recenti</h2>
              <div className="space-y-3">
                {recentActivities.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg">{act.icon}</div>
                    <div className="flex-1">
                      <span className="text-sm">{act.title}</span>
                      <div className="text-xs text-gray-400">{act.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
