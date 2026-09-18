import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/calls/[id]/end — chiude la call
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const callId = parseInt(params.id, 10);
  if (!callId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.call.log', 'action_end', [[callId]]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('calls/end error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
