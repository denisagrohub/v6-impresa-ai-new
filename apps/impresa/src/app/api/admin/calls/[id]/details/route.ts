import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET /api/admin/calls/[id]/details — info per il pannello post-call
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const callId = parseInt(params.id, 10);
  if (!callId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const calls = await odoo.execute('erpv6.call.log', 'search_read', [
      [['id', '=', callId]],
      ['id', 'partner_id', 'relation_id', 'duration_minutes', 'state', 'notes', 'outcomes', 'started_at', 'ended_at'],
    ]);
    if (!calls?.length) return NextResponse.json({ success: false, error: 'Call non trovata' }, { status: 404 });
    const call = calls[0];

    const notes = await odoo.execute('erpv6.call.note', 'search_read', [
      [['call_id', '=', callId]],
      ['id', 'body', 'captured_at', 'promoted_to', 'promoted_field'],
      0, 0, 'captured_at asc',
    ]);

    // sotto-progetti del padre (per "genera lead")
    let siblings: any[] = [];
    const relId = Array.isArray(call.relation_id) ? call.relation_id[0] : null;
    if (relId) {
      const rel = await odoo.execute('erpv6.tracking.relation', 'read', [[relId], ['parent_id', 'child_kind']]);
      const parentId = Array.isArray(rel?.[0]?.parent_id) ? rel[0].parent_id[0] : null;
      const rootId = parentId || relId;
      const subs = await odoo.execute('erpv6.tracking.relation', 'search_read', [
        [['parent_id', '=', rootId], ['child_kind', 'in', ['sotto_progetto', 'pipeline']]],
        ['id', 'name'],
        0, 0, 'name asc',
      ]);
      siblings = subs || [];
    }

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        partnerId: Array.isArray(call.partner_id) ? call.partner_id[0] : null,
        partnerName: Array.isArray(call.partner_id) ? call.partner_id[1] : null,
        relationId: relId,
        durationMinutes: call.duration_minutes || 0,
        state: call.state,
        notes: notes || [],
      },
      siblings,
    });
  } catch (e: any) {
    console.error('call details error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
