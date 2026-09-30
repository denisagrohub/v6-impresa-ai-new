// ═══════════════════════════════════════════════════════════════════
// GET /api/consultant/dashboard-overview
//
// Endpoint aggregatore per la home consultant: fa N fetch paralleli
// verso gli endpoint esistenti. 1 fetch dal frontend, 1 payload.
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

  const [
    projectsRes,
    partnerRes,
    paymentsRes,
    signRes,
    richiesteRes,
    emailsRes,
    myRequestsRes,
  ] = await Promise.all([
    tryFetch(`${origin}/api/consultant/projects`, auth),
    tryFetch(`${origin}/api/consultant/partner-projects`, auth),
    tryFetch(`${origin}/api/consultant/payments`, auth),
    tryFetch(`${origin}/api/consultant/sign-requests`, auth),
    tryFetch(`${origin}/api/consultant/richieste`, auth),
    tryFetch(`${origin}/api/consultant/emails/unread-count`, auth),
    tryFetch(`${origin}/api/consultant/projects/my-requests`, auth),
  ]);

  // Progetti consulenza (orders + leads senza produzione)
  const orders = projectsRes?.orders || projectsRes?.data?.orders || [];
  const leads = projectsRes?.leads_senza_produzione || projectsRes?.data?.leads_senza_produzione || [];
  const projectsCount = orders.length + leads.length;

  // Progetti Partner (dove è parte)
  const partnerProjects = partnerRes?.projects || partnerRes?.data?.projects || [];

  // Compensi: somma importi payments
  const payments = paymentsRes?.payments || paymentsRes?.data?.payments || [];
  const paymentsTotal = payments.reduce((s: number, p: any) => s + (p.importo || 0), 0);

  // Firme pending (sent + viewed)
  const signRequests = signRes?.signRequests || signRes?.data?.signRequests || [];
  const signPending = signRequests.filter((s: any) =>
    s.status === 'sent' || s.status === 'viewed'
  ).length;

  // Richieste aperte
  const richieste = richiesteRes?.richieste || richiesteRes?.data?.richieste || [];
  const richiesteOpen = richieste.filter((r: any) =>
    r.stato !== 'approvata' && r.stato !== 'rifiutata'
  ).length;

  // Email non lette
  const unreadEmails = emailsRes?.unread || emailsRes?.data?.unread || 0;

  // Richieste accesso playbook pending
  const myRequests = myRequestsRes?.requests || myRequestsRes?.data?.requests || [];
  const accessPending = myRequests.filter((r: any) => r.state === 'pending').length;

  return NextResponse.json({
    success: true,
    kpi: {
      projects: { count: projectsCount, orders: orders.length, leads: leads.length },
      partnerProjects: { count: partnerProjects.length },
      signRequestsPending: { count: signPending },
      payments: { count: payments.length, total: Math.round(paymentsTotal * 100) / 100 },
      unreadEmails: { count: unreadEmails },
    },
    alerts: [
      leads.length > 0 && { type: 'leads_to_qualify', count: leads.length, label: 'Lead da qualificare (intervista non completata)', href: '/consultant/dashboard' },
      accessPending > 0 && { type: 'access_pending', count: accessPending, label: 'Richieste accesso playbook in attesa', href: '/consultant/playbook' },
      signPending > 0 && { type: 'sign_pending', count: signPending, label: 'Firme in attesa di essere completate', href: '/consultant/dashboard' },
      richiesteOpen > 0 && { type: 'richieste_open', count: richiesteOpen, label: 'Richieste aperte da gestire', href: '/consultant/dashboard' },
      unreadEmails > 0 && { type: 'unread_emails', count: unreadEmails, label: 'Email non lette', href: '/consultant/mia-email' },
    ].filter(Boolean),
  });
}
