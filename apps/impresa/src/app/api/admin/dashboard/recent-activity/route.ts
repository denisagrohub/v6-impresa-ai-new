import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 01/10/2026 (Fase A - A1): feed unificato attività recenti.
// Aggrega 4 modelli Odoo (deal.event, sign.request, project.email.log,
// partnership.candidacy) in un unico array ordinato per data DESC.
// Read-only: nessun invio, nessuna notifica.
//
// Fonte: docs/RICOGNIZIONE A1. I 4 modelli esistono e hanno campo
// create_date + campo descrittivo.

type ActivityRecord = {
  type: string;
  icon: string;
  title: string;
  href: string | null;
  timestamp: string;
};

export async function GET() {
  try {
    await odoo.connect();

    const results: ActivityRecord[] = [];

    // 1. DEAL EVENT — ultimi eventi timeline deal
    try {
      const events = await odoo.execute('erpv6.deal.event', 'search_read', [
        [],
        ['id', 'title', 'event_type', 'deal_id', 'relation_id', 'create_date'],
        0, 15, 'create_date desc',
      ]);
      for (const e of events || []) {
        const dealId = Array.isArray(e.deal_id) ? e.deal_id[0] : e.deal_id;
        const relId = Array.isArray(e.relation_id) ? e.relation_id[0] : e.relation_id;
        let href: string | null = null;
        if (dealId) href = `/admin/deals/${dealId}`;
        else if (relId) href = `/admin/partner-projects/${relId}`;

        results.push({
          type: 'deal_event',
          icon: e.event_type === 'tavolo_incontro' ? '🪑'
              : e.event_type === 'call' ? '📞'
              : e.event_type === 'email_rilevante' ? '📧'
              : '📌',
          title: e.title || '(evento senza titolo)',
          href,
          timestamp: e.create_date,
        });
      }
    } catch (e: any) {
      console.error('recent-activity deal.event:', e.message);
    }

    // 2. SIGN REQUEST — ultime firme
    try {
      const signs = await odoo.execute('erpv6.sign.request', 'search_read', [
        [],
        ['id', 'name', 'status', 'partner_id', 'create_date'],
        0, 15, 'create_date desc',
      ]);
      for (const s of signs || []) {
        const partnerName = Array.isArray(s.partner_id) ? s.partner_id[1] : '';
        results.push({
          type: 'sign',
          icon: s.status === 'signed' ? '✅'
              : s.status === 'sent' || s.status === 'viewed' ? '✍️'
              : s.status === 'declined' ? '❌'
              : '📄',
          title: `${s.name}${partnerName ? ' — ' + partnerName : ''} · ${s.status}`,
          href: null, // niente href diretto al singolo record (verificato R1.5)
          timestamp: s.create_date,
        });
      }
    } catch (e: any) {
      console.error('recent-activity sign.request:', e.message);
    }

    // 3. EMAIL LOG — ultime email in ricezione
    try {
      const emails = await odoo.execute('erpv6.project.email.log', 'search_read', [
        [['direction', '=', 'ricevuta']],
        ['id', 'name', 'sender_email', 'relation_id', 'create_date'],
        0, 15, 'create_date desc',
      ]);
      for (const em of emails || []) {
        const relId = Array.isArray(em.relation_id) ? em.relation_id[0] : em.relation_id;
        results.push({
          type: 'email',
          icon: '📧',
          title: `${em.name}${em.sender_email ? ' — ' + em.sender_email : ''}`,
          href: relId ? `/admin/partner-projects/${relId}` : null,
          timestamp: em.create_date,
        });
      }
    } catch (e: any) {
      console.error('recent-activity email.log:', e.message);
    }

    // 4. CANDIDACY — ultime candidature partnership
    try {
      const cands = await odoo.execute('erpv6.partnership.candidacy', 'search_read', [
        [],
        ['id', 'name', 'company_name', 'state', 'create_date'],
        0, 15, 'create_date desc',
      ]);
      for (const c of cands || []) {
        results.push({
          type: 'candidacy',
          icon: c.state === 'approvata' ? '✅'
              : c.state === 'rifiutata' ? '❌'
              : '📥',
          title: `${c.company_name || c.name} · ${c.state}`,
          href: null, // niente href al singolo record (verificato R1.5)
          timestamp: c.create_date,
        });
      }
    } catch (e: any) {
      console.error('recent-activity candidacy:', e.message);
    }

    // Sort DESC per timestamp
    results.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });

    return NextResponse.json({
      success: true,
      recentActivity: results.slice(0, 20),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/dashboard/recent-activity:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore' },
      { status: 502 }
    );
  }
}
