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
    partnersPayRes,
    projectsRes,
    commissionsRes,
    paymentsRes,
    recentActivityRes,
    unreadSummaryRes,
  ] = await Promise.all([
    tryFetch(`${origin}/api/admin/deals`, auth),
    // 01/10/2026 (A1): limit=20 per costruire nextActions.records (max 5 usati)
    tryFetch(`${origin}/api/admin/sign-requests?limit=20`, auth),
    tryFetch(`${origin}/api/admin/access-requests`, auth),
    tryFetch(`${origin}/api/admin/candidacies?state=nuova`, auth),
    tryFetch(`${origin}/api/admin/partners-payments`, auth),
    tryFetch(`${origin}/api/admin/partner-projects`, auth),
    tryFetch(`${origin}/api/admin/commissions`, auth),
    tryFetch(`${origin}/api/admin/payments`, auth),
    // 01/10/2026 (A1): feed attività recenti (nuovo endpoint aggregato)
    tryFetch(`${origin}/api/admin/dashboard/recent-activity`, auth),
    // 01/10/2026 (A1): email non lette per progetto
    tryFetch(`${origin}/api/admin/partner-projects/unread-summary`, auth),
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

  // Pagamenti partner scaduti (fatture con giorni_ritardo > 0)
  const partnersPay = partnersPayRes?.payments || partnersPayRes?.data?.payments || [];
  const paymentsOverdue = partnersPay.filter((p: any) => (p.giorniRitardo || 0) > 0).length;

  // Contabilità: commissioni + tranche consulenza da incassare
  const commissions = commissionsRes?.commissions || commissionsRes?.data?.commissions || [];
  const commissionsTotal = commissions.reduce((s: number, c: any) => s + (c.commissione || 0), 0);
  const tranches = paymentsRes?.tranches || paymentsRes?.data?.tranches || [];
  const tranchesDaIncassare = tranches.filter((t: any) => t.stato === 'da_incassare');
  const tranchesPendingCount = tranchesDaIncassare.length;
  const tranchesPendingAmount = tranchesDaIncassare.reduce((s: number, t: any) => s + (t.importo || 0), 0);

  // Progetti Partner (root tracking_relation padre)
  const projects = projectsRes?.projects || projectsRes?.data?.projects || [];
  const partnerProjectsCount = projects.length;

  // ═════════════════════════════════════════════════════════════════
  // 01/10/2026 (A1): nextActions — record actionable raggruppati per tipo
  // Regole: max 5 record, href a lista sempre, href record se esiste
  // ═════════════════════════════════════════════════════════════════
  const nextActions: any[] = [];

  // 1. Firme in attesa
  const signRequests = signRes?.signRequests || signRes?.data?.signRequests || [];
  if (signKpi.pending > 0) {
    const pendingRecs = signRequests
      .filter((s: any) => s.status === 'sent' || s.status === 'viewed')
      .slice(0, 5)
      .map((s: any) => {
        const ts = s.sentAt || s.createdAt || null;
        return {
          id: s.id,
          title: s.name || `Firma #${s.id}`,
          subtitle: `stato: ${s.status}${s.partnerName ? ' — ' + s.partnerName : ''}`,
          timestamp: ts,
          // R1.5: /admin/firme non supporta ?highlight → href null
          href: null,
        };
      })
      .filter((r: any) => r.id && r.title);

    nextActions.push({
      type: 'sign_pending',
      label: `${signKpi.pending} ${signKpi.pending === 1 ? 'firma in attesa' : 'firme in attesa'}`,
      count: signKpi.pending,
      href: '/admin/firme',
      records: pendingRecs,
    });
  }

  // 2. Email non lette (aggregato da unread-summary)
  const unreadSummary = unreadSummaryRes?.summary || {};
  const totalUnread = Object.values(unreadSummary).reduce(
    (s: number, n: any) => s + (typeof n === 'number' ? n : 0),
    0
  );
  if (totalUnread > 0) {
    nextActions.push({
      type: 'email_unread',
      label: `${totalUnread} ${totalUnread === 1 ? 'email non letta' : 'email non lette'}`,
      count: totalUnread,
      href: '/admin/partner-projects',
      // Il summary non ha record singoli → records vuoto
      records: [],
    });
  }

  // 3. Incassi in attesa (tranche consulenza)
  if (tranchesPendingCount > 0) {
    const tranchesRecs = tranchesDaIncassare
      .slice(0, 5)
      .map((t: any) => ({
        id: t.id,
        title: t.descrizione || t.name || `Tranche #${t.id}`,
        subtitle: `€${(t.importo || 0).toLocaleString('it-IT')} — ${t.stato}`,
        timestamp: t.create_date || null,
        href: null,
      }))
      .filter((r: any) => r.id && r.title);

    nextActions.push({
      type: 'payment_due',
      label: `${tranchesPendingCount} ${tranchesPendingCount === 1 ? 'incasso in attesa' : 'incassi in attesa'}`,
      count: tranchesPendingCount,
      href: '/admin/payments',
      records: tranchesRecs,
    });
  }

  // recentActivity — già pronto dall'endpoint dedicato
  const recentActivity = recentActivityRes?.recentActivity || [];

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
      accounting: {
        commissionsTotal: Math.round(commissionsTotal * 100) / 100,
        tranchesPendingCount: tranchesPendingCount,
        tranchesPendingAmount: Math.round(tranchesPendingAmount * 100) / 100,
      },
    },
    alerts: [
      accessReqCount > 0 && { type: 'access_requests', count: accessReqCount, label: 'Richieste accesso playbook in attesa', href: '/admin/access-requests' },
      signKpi.pending > 0 && { type: 'sign_pending', count: signKpi.pending, label: 'Firme in attesa di essere completate', href: '/admin/firme' },
      paymentsOverdue > 0 && { type: 'payments_overdue', count: paymentsOverdue, label: 'Pagamenti scaduti', href: '/admin/payments' },
      candNew > 0 && { type: 'candidacies_new', count: candNew, label: 'Nuove candidature partnership', href: '/admin/candidature' },
      tranchesPendingCount > 0 && { type: 'tranches_pending', count: tranchesPendingCount, label: 'Tranche consulenza da incassare', href: '/admin/payments' },
    ].filter(Boolean),
    // 01/10/2026 (A1): nuovi campi
    nextActions,
    recentActivity,
  });
}
