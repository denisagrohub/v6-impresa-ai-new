// ═══════════════════════════════════════════════════════════════════
// /admin/dashboard — dashboard admin con KPI adattivi per ruolo.
//
// 30/09/2026 (Refactor dashboard): sostituisce la vecchia dashboard
// business-plan-centrica. Nuova struttura:
// - 4 KPI cliccabili in alto (Deal, Progetti Partner, Firme, Richieste)
// - Alert operativi (solo se > 0): accesso, firme, pagamenti, candidature
// - 2 colonne: pipeline deal + attività recenti
//
// Filtro per ruolo: admin vede tutto; chief_projects vede deal+firme;
// chief_bandi vede candidature. Zero duplicazione: tutte le azioni
// vivono nelle pagine dedicate.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderKanban, Briefcase, FileSignature, Send,
  ArrowRight, Loader2, RefreshCw, Euro, Users, Landmark, Mail,
} from 'lucide-react';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import { OdooStatus } from '@/components/admin/OdooStatus';
import ActionToday from '@/components/admin/dashboard/ActionToday';
import ActivityFeed from '@/components/admin/dashboard/ActivityFeed';
import TodoToday from '@/components/admin/dashboard/TodoToday';
import SuggestionsToday from '@/components/admin/dashboard/SuggestionsToday';
import { userHasPermission } from '@/lib/permissions';

type Kpi = {
  dealsActive: { count: number; feeMonthlyBase: number };
  partnerProjects: { count: number; candidaciesNew: number; withDeal?: number; withoutDeal?: number };
  signRequestsPending: { count: number; sent: number; viewed: number; over48h?: number };
  emailUnread?: { total: number; project: number; personal: number };
  accessRequestsPending: { count: number };
  accounting: {
    commissionsTotal: number;
    tranchesPendingCount: number;
    tranchesPendingAmount: number;
  };
};

type NextAction = {
  type: string;
  count: number;
  label: string;
  href: string;
  records: Array<{
    id: number | string;
    title: string;
    subtitle: string;
    timestamp: string | null;
    href: string | null;
  }>;
};

const fmtEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [recentActivity, setRecentActivity] = useState<Array<{ type: string; icon: string; title: string; href: string | null; timestamp: string }>>([]);
  // 02/10/2026 (C2): conteggio email non lette
  const [emailCounts, setEmailCounts] = useState<{ total: number; project: number; personal: number } | null>(null);

  // 01/10/2026 (A4): auto-refresh + stato live
  const [refreshError, setRefreshError] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 01/10/2026 (A4.1): countdown al prossimo refresh automatico
  const [secondsToNextRefresh, setSecondsToNextRefresh] = useState<number>(60);

  const authHeaders = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem('pi_session');
      const s = raw ? JSON.parse(raw) : null;
      return s?.token ? { Authorization: `JWT ${s.token}` } : {};
    } catch { return {}; }
  };

  const loadDashboard = async () => {
    // 01/10/2026 (A4.1): primo caricamento → loader full; refresh → spinner inline.
    if (!kpi) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const r = await fetch('/api/admin/dashboard-overview', { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Errore');
      setKpi(d.kpi);
      setNextActions(d.nextActions || []);
      setRecentActivity(d.recentActivity || []);
      setRefreshError(false);
    } catch (e: any) {
      setError(e.message);
      setRefreshError(true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      // 01/10/2026 (A4.1): ogni refresh (auto o manuale) riavvia il countdown
      setSecondsToNextRefresh(60);
    }
  };

  // Alias retro-compatibile (usato da onRefresh dei figli)
  const loadData = () => loadDashboard();

  // 01/10/2026 (A4.1): ref stabile per chiamare loadDashboard dal timer
  const loadDashboardRef = useRef(loadDashboard);
  loadDashboardRef.current = loadDashboard;

  useEffect(() => {
    const raw = localStorage.getItem('pi_session');
    if (!raw) { router.push('/login'); return; }
    setUser(JSON.parse(raw));
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 01/10/2026 (A4.1): refresh al ritorno sulla tab
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') loadDashboardRef.current();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 01/10/2026 (A4.1): countdown 1s. A 0 → refresh (se tab visibile) + reset 60s.
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsToNextRefresh((s) => {
        if (s <= 1) {
          if (document.visibilityState === 'visible') {
            loadDashboardRef.current();
          }
          return 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // 02/10/2026 (C2): conteggio email non lette (endpoint separato)
  useEffect(() => {
    const loadEmailCounts = async () => {
      try {
        const r = await fetch('/api/admin/emails/counts', { headers: authHeaders() });
        if (!r.ok) return;
        const d = await r.json();
        if (d?.success !== false) {
          setEmailCounts({
            total: d.total ?? d.unread_total ?? 0,
            project: d.project ?? d.unread_project ?? 0,
            personal: d.personal ?? d.unread_personal ?? 0,
          });
        }
      } catch {
        // silenzioso
      }
    };
    loadEmailCounts();
    const t = setInterval(loadEmailCounts, 120_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles: string[] = user?.roles || (user?.role ? [user.role] : []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Panoramica operativa V6"
      user={user}
    >
      <div className="p-8 max-w-7xl mx-auto">

        {/* Odoo status + refresh */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1"><OdooStatus /></div>
          {/* 01/10/2026 (A4.1): indicatore live — pallino + countdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              {isRefreshing ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              ) : refreshError ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              )}
            </span>
            <span className="text-gray-500 tabular-nums">
              {isRefreshing
                ? 'aggiornamento in corso...'
                : refreshError
                ? 'ultimo aggiornamento fallito'
                : `prossimo refresh tra ${secondsToNextRefresh}s`}
            </span>
          </div>
          <button
            onClick={() => loadDashboard()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Aggiorna
          </button>
        </div>

        {refreshError && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ultimo aggiornamento fallito. Riprovo tra 60 secondi.
          </div>
        )}

        {error && !refreshError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            KPI STRIP — 4 card cliccabili
            ══════════════════════════════════════════════════════════ */}
        {kpi && (
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">

            {/* Deal attivi */}
            {userHasPermission(roles, 'dashboard.view_kpi_deals') && (
              <Link
                href="/admin/deals"
                className="group bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Briefcase size={20} className="text-indigo-600" />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="text-3xl font-bold text-[#1a2744] leading-none mb-1">
                  {kpi.dealsActive.count}
                </div>
                <div className="text-xs text-gray-500">Deal attivi</div>
                {kpi.dealsActive.feeMonthlyBase > 0 && (
                  <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                    {fmtEur(kpi.dealsActive.feeMonthlyBase)}/mese
                  </div>
                )}
              </Link>
            )}

            {/* Progetti Partner */}
            {userHasPermission(roles, 'dashboard.view_kpi_partner_projects') && (
              <Link
                href="/admin/partner-projects"
                className="group bg-white rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <FolderKanban size={20} className="text-orange-600" />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
                </div>
                <div className="text-3xl font-bold text-[#1a2744] leading-none mb-1">
                  {kpi.partnerProjects.count}
                </div>
                <div className="text-xs text-gray-500">Progetti Partner</div>
                {/* 01/10/2026 (C3a): breakdown con/senza deal */}
                {typeof kpi.partnerProjects.withDeal === 'number' && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    {kpi.partnerProjects.withDeal} con deal · {kpi.partnerProjects.withoutDeal ?? 0} senza deal
                  </div>
                )}
                {kpi.partnerProjects.candidaciesNew > 0 && (
                  <div className="text-[11px] text-red-600 font-semibold mt-1">
                    {kpi.partnerProjects.candidaciesNew} candidature nuove
                  </div>
                )}
              </Link>
            )}

            {/* Firme pending */}
            {userHasPermission(roles, 'dashboard.view_kpi_signatures') && (
              <Link
                href="/admin/firme"
                className="group bg-white rounded-2xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <FileSignature size={20} className="text-amber-600" />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-500 transition-colors" />
                </div>
                <div className={`text-3xl font-bold leading-none mb-1 ${kpi.signRequestsPending.count === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {kpi.signRequestsPending.count}
                </div>
                <div className="text-xs text-gray-500">Firme in attesa</div>
                {kpi.signRequestsPending.count > 0 && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    {kpi.signRequestsPending.sent} inviate · {kpi.signRequestsPending.viewed} viste
                    {typeof kpi.signRequestsPending.over48h === 'number' && kpi.signRequestsPending.over48h > 0 && (
                      <span className="text-amber-600 font-semibold"> · {kpi.signRequestsPending.over48h} da &gt;48h</span>
                    )}
                  </div>
                )}
              </Link>
            )}

            {/* Richieste accesso */}
            {userHasPermission(roles, 'dashboard.view_kpi_access_requests') && (
              <Link
                href="/admin/access-requests"
                className={`group bg-white rounded-2xl border transition-all p-5 ${
                  kpi.accessRequestsPending.count > 0
                    ? 'border-emerald-300 ring-1 ring-emerald-100 hover:shadow-md'
                    : 'border-gray-100 hover:border-emerald-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Send size={20} className="text-emerald-600" />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className={`text-3xl font-bold leading-none mb-1 ${kpi.accessRequestsPending.count === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {kpi.accessRequestsPending.count}
                </div>
                <div className="text-xs text-gray-500">Richieste accesso</div>
                {kpi.accessRequestsPending.count > 0 && (
                  <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                    Da approvare
                  </div>
                )}
              </Link>
            )}

            {/* Contabilità (commissioni + tranche pending) */}
            {userHasPermission(roles, 'dashboard.view_kpi_accounting') && (
              <Link
                href="/admin/accounting"
                className={`group bg-white rounded-2xl border transition-all p-5 ${
                  kpi.accounting.tranchesPendingCount > 0
                    ? 'border-cyan-300 ring-1 ring-cyan-100 hover:shadow-md'
                    : 'border-gray-100 hover:border-cyan-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                    <Landmark size={20} className="text-cyan-600" />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-cyan-500 transition-colors" />
                </div>
                <div className="text-3xl font-bold text-[#1a2744] leading-none mb-1">
                  {fmtEur(kpi.accounting.commissionsTotal)}
                </div>
                <div className="text-xs text-gray-500">Commissioni consulenti</div>
                {kpi.accounting.tranchesPendingCount > 0 && (
                  <div className="text-[11px] text-cyan-700 font-semibold mt-1">
                    {kpi.accounting.tranchesPendingCount} tranche da incassare
                  </div>
                )}
              </Link>
            )}

            {/* Email non lette — C2 (02/10/2026) */}
            {emailCounts && (
              <Link
                href="/admin/mia-email"
                className={`group bg-white rounded-2xl border transition-all p-5 ${
                  emailCounts.total > 0
                    ? 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
                    : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Mail size={20} className="text-gray-600" />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
                <div className="text-3xl font-bold text-[#1a2744] leading-none mb-1">
                  {emailCounts.total}
                </div>
                <div className="text-xs text-gray-500">Email non lette</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {emailCounts.project} progetto · {emailCounts.personal} personali
                </div>
              </Link>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            AZIONI DI OGGI — da nextActions[] (A2)
            ══════════════════════════════════════════════════════════ */}
        <ActionToday nextActions={nextActions} onRefresh={loadData} />

        {/* ══════════════════════════════════════════════════════════
            SUGGERIMENTI AI — da /api/admin/suggestions (C1b-2)
            ══════════════════════════════════════════════════════════ */}
        <SuggestionsToday />

        {/* ══════════════════════════════════════════════════════════
            I MIEI TODO — da /api/admin/todos (C1a-2b)
            ══════════════════════════════════════════════════════════ */}
        <TodoToday />

        {/* ══════════════════════════════════════════════════════════
            ATTIVITÀ RECENTE — da recentActivity[] (A3)
            ══════════════════════════════════════════════════════════ */}
        <ActivityFeed activity={recentActivity} />

        {/* ══════════════════════════════════════════════════════════
            Azioni rapide
            ══════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
            Azioni rapide
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Link href="/admin/deals" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm text-sm font-medium text-gray-700">
              <Briefcase size={16} className="text-indigo-600" /> Nuovo Deal
            </Link>
            <Link href="/admin/partner-projects" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm text-sm font-medium text-gray-700">
              <FolderKanban size={16} className="text-orange-600" /> Progetti Partner
            </Link>
            <Link href="/admin/team/users" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm text-sm font-medium text-gray-700">
              <Users size={16} className="text-purple-600" /> Utenti e ruoli
            </Link>
            <Link href="/admin/payments" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm text-sm font-medium text-gray-700">
              <Euro size={16} className="text-emerald-600" /> Pagamenti
            </Link>
            <Link href="/admin/accounting" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-cyan-300 hover:shadow-sm text-sm font-medium text-gray-700">
              <Landmark size={16} className="text-cyan-600" /> Commissioni
            </Link>
          </div>
        </section>

      </div>
    </AdminLayout>
  );
}
