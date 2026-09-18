import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/calls/start — apre una Live Call
// body: { partnerId, relationId?, leadId? }
export async function POST(request: Request) {
  try {
    const { partnerId, relationId, leadId } = await request.json();
    if (!partnerId) return NextResponse.json({ success: false, error: 'partnerId obbligatorio' }, { status: 400 });

    await odoo.connect();
    const vals: any = { partner_id: partnerId, state: 'live' };
    if (relationId) vals.relation_id = relationId;
    if (leadId) vals.lead_id = leadId;

    const callId = await odoo.execute('erpv6.call.log', 'create', [vals]);
    return NextResponse.json({ success: true, callId });
  } catch (e: any) {
    console.error('calls/start error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
