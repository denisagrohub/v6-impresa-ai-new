import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// PATCH /api/admin/acquisition/leads/[id]
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const leadId = parseInt(params.id, 10);
  if (!leadId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    const { stageId, destRelationId } = await request.json();
    await odoo.connect();

    if (stageId) {
      const result = await odoo.execute('erpv6.acquisition.lead', 'action_move_to_stage', [leadId, stageId]);
      return NextResponse.json({ success: true, result });
    }
    if (destRelationId) {
      const result = await odoo.execute('erpv6.acquisition.lead', 'api_move_to_sibling', [leadId, destRelationId]);
      return NextResponse.json({ success: true, result });
    }
    return NextResponse.json({ success: false, error: 'stageId o destRelationId richiesto' }, { status: 400 });
  } catch (e: any) {
    console.error('patch lead error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

// GET siblings per il lead
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const leadId = parseInt(params.id, 10);
  if (!leadId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const siblings = await odoo.execute('erpv6.acquisition.lead', 'action_suggest_siblings', [leadId]);
    return NextResponse.json({ success: true, siblings });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
