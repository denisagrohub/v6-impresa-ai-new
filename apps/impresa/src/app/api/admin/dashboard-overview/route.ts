// ═══════════════════════════════════════════════════════════════════
// GET /api/admin/dashboard-overview
//
// Endpoint aggregatore per la dashboard admin. Fa N fetch paralleli
// verso gli endpoint esistenti e ritorna un payload unico. Così il
// frontend fa UNA fetch e la dashboard ha tutti i numeri in un colpo.
//
// Lean: un solo punto da manutenere. Se un sotto-fetch fallisce,
// ritorna valore default (0) senza bloccare la dashboard.
// ═══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';

async function tryFetch(url: string, auth: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || '';
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });

  const origin = request.nextUrl.origin;

  // Fetch paralleli degli endpoint esistenti (stessa istanza Next.js)
  const [
    dealsRes,
    signRes,
    accessRes,
    candRes,
    paymentsRes,
    projectsRes,
  ] = await Promise.all([
    tryFetch(`${origin}/api/admin/deals`, auth),
    tryFetch(`${origin}/api/admin/sign-requests?limit=1`, auth),
    tryFetch(`${origin}/api/admin/access-requests`, auth),
    tryFetch(`${origin}/api/admin/candidacies?state=nuova`, auth),
    tryFetch(`${origin}/api/admin/partners-payments`, auth),
    tryFetch(`${origin}/api/admin/partner-projects`, auth),
  ]);

  // Deals KPI
  const dk = dealsRes?.kpi || {};
  const dealsKpi = {
    active: dk.active || 0,
    signing: dk.signing || 0,
    frozen: dk.frozen || 0,
    forecasting: dk.forecasting || 0,
    total: dk.totalDeals || 0,
    feeMonthlyBase: dk.feeMonthlyBase || 0,
  };

  // Firme pending (sent + viewed)
  const sc = signRes?.counts || signRes?.data?.counts || {};
  const signKpi = {
    sent: sc.sent || 0,
    viewed: sc.viewed || 0,
    pending: (sc.sent || 0) + (sc.viewed || 0),
  };

  // Richieste accesso playbook
  const accessReqCount = accessRes?.count || accessRes?.data?.count || 0;

  // Candidature nuove
  const candList = candRes?.candidacies || candRes?.data?.candidacies || [];
  const candNew = candList.filter((c: any) => c.state === 'nuova').length;

  // Pagamenti scaduti (fatture con giorni_ritardo > 0)
  const payments = paymentsRes?.payments || paymentsRes?.data?.payments || [];
  const paymentsOverdue = payments.filter((p: any) => (p.giorniRitardo || 0) > 0).length;

  // Progetti Partner (root tracking_relation padre)
  const projects = projectsRes?.projects || projectsRes?.data?.projects || [];
  const partnerProjectsCount = projects.length;

  return NextResponse.json({
    success: true,
    kpi: {
      dealsActive: {
        count: dealsKpi.active + dealsKpi.signing,
        feeMonthlyBase: dealsKpi.feeMonthlyBase,
      },
      partnerProjects: {
        count: partnerProjectsCount,
        candidaciesNew: candNew,
      },
      signRequestsPending: {
        count: signKpi.pending,
        sent: signKpi.sent,
        viewed: signKpi.viewed,
      },
      accessRequestsPending: {
        count: accessReqCount,
      },
    },
    alerts: [
      accessReqCount > 0 && { type: 'access_requests', count: accessReqCount, label: 'Richieste accesso playbook in attesa', href: '/admin/access-requests' },
      signKpi.pending > 0 && { type: 'sign_pending', count: signKpi.pending, label: 'Firme in attesa di essere completate', href: '/admin/firme' },
      paymentsOverdue > 0 && { type: 'payments_overdue', count: paymentsOverdue, label: 'Pagamenti scaduti', href: '/admin/payments' },
      candNew > 0 && { type: 'candidacies_new', count: candNew, label: 'Nuove candidature partnership', href: '/admin/candidature' },
    ].filter(Boolean),
  });
}
