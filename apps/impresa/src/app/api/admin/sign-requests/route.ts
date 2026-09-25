import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 25/09/2026: tab "Firme" in dashboard admin. Vista unica di tutti i
// sign request (split V6, NDA, NCND, contratti, referral) con filtri
// per stato/tipo/progetto/firmatario. Sostituisce il "vai al progetto
// X per vedere se ha firmato".
//
// Query params:
//   status=sent,viewed      (CSV, default: tutti tranne cancelled)
//   kind=split_v6,nda       (CSV, default: tutti)
//   projectId=5             (opzionale)
//   partnerId=97            (opzionale)
//   from=2026-09-01         (opzionale, ISO date)
//   to=2026-09-30           (opzionale)
//   limit=50&offset=0
//
// Response:
//   { success, signRequests: [...], total, counts: { sent: N, ... } }
export async function GET(request: Request) {
  try {
    await odoo.connect();

    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status') || '';
    const kindParam = url.searchParams.get('kind') || '';
    const projectId = url.searchParams.get('projectId');
    const partnerId = url.searchParams.get('partnerId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Costruisci domain
    const domain: any[] = [];
    if (statusParam) {
      const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length) domain.push(['status', 'in', statuses]);
    } else {
      // Default: tutto tranne cancelled
      domain.push(['status', '!=', 'cancelled']);
    }
    if (kindParam) {
      const kinds = kindParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (kinds.length) domain.push(['related_kind', 'in', kinds]);
    }
    if (projectId) domain.push(['split_project_id', '=', parseInt(projectId, 10)]);
    if (partnerId) domain.push(['partner_id', '=', parseInt(partnerId, 10)]);
    if (from) domain.push(['create_date', '>=', from]);
    if (to) domain.push(['create_date', '<=', to]);

    // Query principale
    const signRequests = await odoo.execute('erpv6.sign.request', 'search_read', [
      domain,
      ['id', 'name', 'related_kind', 'status', 'external_id',
       'partner_id', 'split_project_id', 'sent_at', 'signed_at',
       'create_date', 'write_date', 'request_url', 'notes'],
      offset, limit, 'create_date desc',
    ]);

    // Conta totale
    const total = await odoo.execute('erpv6.sign.request', 'search_count', [domain]);

    // Counts per stato (indipendente dai filtri attuali, per badge)
    const allDomain = domain.filter((d: any) => d[0] !== 'status');
    const counts: Record<string, number> = {};
    for (const st of ['sent', 'viewed', 'signed', 'rejected', 'expired', 'cancelled', 'draft']) {
      counts[st] = await odoo.execute('erpv6.sign.request', 'search_count', [
        [...allDomain, ['status', '=', st]],
      ]);
    }

    return NextResponse.json({
      success: true,
      signRequests: (signRequests || []).map((sr: any) => ({
        id: sr.id,
        name: sr.name,
        kind: sr.related_kind || null,
        status: sr.status,
        externalId: sr.external_id || null,
        requestUrl: sr.request_url || null,
        partnerId: Array.isArray(sr.partner_id) ? sr.partner_id[0] : null,
        partnerName: Array.isArray(sr.partner_id) ? sr.partner_id[1] : null,
        projectId: Array.isArray(sr.split_project_id) ? sr.split_project_id[0] : null,
        projectName: Array.isArray(sr.split_project_id) ? sr.split_project_id[1] : null,
        sentAt: sr.sent_at || null,
        signedAt: sr.signed_at || null,
        createdAt: sr.create_date,
        updatedAt: sr.write_date,
        notes: sr.notes || null,
      })),
      total: typeof total === 'number' ? total : (total?.length ?? 0),
      counts,
      filters: { statusParam, kindParam, projectId, partnerId, from, to },
    });
  } catch (e: any) {
    console.error('❌ /api/admin/sign-requests:', e.message);
    return NextResponse.json(
      { success: false, error: e.message || 'Errore Odoo' },
      { status: 502 }
    );
  }
}
