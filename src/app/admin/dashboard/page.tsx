"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation"; // ✅ Aggiunto usePathname
import Link from "next/link";
import {
  Loader2, LayoutDashboard, FolderKanban, CheckCircle2,
  Mail, Users, Settings, LogOut, TrendingUp, Clock,
  FileText, Building2, Briefcase, Landmark,
  Palette, Target, Server, Calculator, AlertTriangle, DollarSign
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname(); // ✅ Hook per ottenere il percorso corrente
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    progettiAttivi: 0,
    leadOggi: 0,
    fatturatoMese: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    const session = localStorage.getItem("pi_session");
    if (!session) {
      router.push("/admin/login");
      return;
    }

    // Carica stats reali da API
    fetch('/api/admin/stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setStats({
            progettiAttivi: data.progettiAttivi || 0,
            leadOggi: data.leadOggi || 0,
            fatturatoMese: data.fatturatoMese || 0,
            conversionRate: data.conversionRate || 0,
          });
        }
      })
      .catch(err => {
        console.error('Errore caricamento stats:', err);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("pi_session");
    // Cancella anche il cookie impostando una data di scadenza nel passato
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };
  const totalMonthlyCost = 0;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={40} className="animate-spin text-orange-500" />
      </div>
    );
  }

  // ✅ Rimossa la proprietà 'active' hardcoded, ora è dinamica
  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: FolderKanban, label: "Progetti", href: "/admin/projects" },
    { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
    { icon: Users, label: "Coda Lead", href: "/admin/leads" },
    { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
    { icon: Landmark, label: "Contabilità", href: "/admin/accounting" },
    { icon: Mail, label: "Email", href: "/admin/email" },
    { icon: Users, label: "Partner", href: "/admin/partners" },
    { icon: Palette, label: "Gestione Brand", href: "/admin/settings/brands" },
    { icon: Calculator, label: "Provvigioni & Margini", href: "/admin/settings/commissions" },
    { icon: AlertTriangle, label: "Richieste & Segnalazioni", href: "/admin/requests" },
    { icon: Settings, label: "Impostazioni Sistema", href: "/admin/settings/system" },
    { icon: Server, label: "Gateway Debug", href: "/admin/gateway-debug" },
    { icon: Mail, label: "Recupero Lead", href: "/admin/lead-recovery" },
    { icon: Target, label: "Config. Scoring", href: "/admin/settings/scoring" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar Admin */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center text-white font-bold">
              PI
            </div>
            <div>
              <div className="font-bold text-[#1a2744]">Progetto Impresa</div>
              <div className="text-xs text-gray-500">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, i) => {
            // ✅ Logica dinamica per l'evidenziazione del menu attivo
            const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={i}
                href={item.href as any}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                    ? 'bg-[#1a2744] text-white shadow-lg shadow-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all w-full"
          >
            <LogOut size={18} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2744]">Dashboard</h1>
            <p className="text-sm text-gray-500">Panoramica del sistema</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-[#1a2744]">Admin</div>
              <div className="text-xs text-gray-500">admin@progettoimpresa.it</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shadow-md">
              A
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 max-w-7xl mx-auto">
          {/* Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { icon: FolderKanban, label: "Progetti Attivi", value: stats.progettiAttivi, color: "bg-blue-100 text-blue-600", change: "+2" },
              { icon: Users, label: "Lead Oggi", value: stats.leadOggi, color: "bg-green-100 text-green-600", change: "+1" },
              { icon: TrendingUp, label: "Fatturato Mese", value: stats.fatturatoMese > 0 ? `€${(stats.fatturatoMese / 1000).toFixed(0)}k` : '€0k', color: "bg-orange-100 text-orange-600", change: "+18%" },
              { icon: Clock, label: "Tasso Conversione", value: `${stats.conversionRate}%`, color: "bg-purple-100 text-purple-600", change: "+5%" },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon size={24} />
                  </div>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold text-[#1a2744] mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-bold text-[#1a2744] mb-4">Azioni Rapide</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/admin/validazione" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                  <CheckCircle2 size={20} className="text-orange-600" />
                </div>
                <div>
                  <div className="font-semibold text-[#1a2744]">Valida Progetti</div>
                  <div className="text-xs text-gray-500">5 in attesa</div>
                </div>
              </Link>
              <Link href="/admin/leads" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-[#1a2744]">Coda Lead</div>
                  <div className="text-xs text-gray-500">3 da sincronizzare</div>
                </div>
              </Link>
              <Link href="/admin/settings/system" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Settings size={20} className="text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-[#1a2744]">Impostazioni</div>
                  <div className="text-xs text-gray-500">Configura sistema</div>
                </div>
              </Link>
              <Link href="/api/admin/api-costs" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign size={20} className="text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-[#1a2744]">Costi API</div>
                  <div className="text-xs text-gray-500">€{totalMonthlyCost.toFixed(2)}/mese</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-[#1a2744] mb-4">Attività Recente</h2>
            <div className="space-y-4">
              {[
                { icon: Building2, text: "Nuovo lead L1 - Marco Bianchi", time: "2 ore fa", color: "bg-blue-100 text-blue-600" },
                { icon: Briefcase, text: "Progetto L2 completato - PMI Metalmeccanica", time: "5 ore fa", color: "bg-green-100 text-green-600" },
                { icon: Landmark, text: "Call discovery - Banca Generali", time: "1 giorno fa", color: "bg-orange-100 text-orange-600" },
                { icon: FileText, text: "Business Plan consegnato - Startup Tech", time: "2 giorni fa", color: "bg-purple-100 text-purple-600" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-lg ${activity.color} flex items-center justify-center flex-shrink-0`}>
                    <activity.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1a2744] truncate">{activity.text}</div>
                    <div className="text-xs text-gray-500">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
