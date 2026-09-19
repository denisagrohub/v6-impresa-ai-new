import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST — approva split (congela + hash + ancora OTS)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.tracking.relation', 'action_approve_revenue_split', [[id]]);
    const [p] = await odoo.execute('erpv6.tracking.relation', 'read', [[id], ['revenue_split_hash', 'revenue_split_approved_at']]);
    return NextResponse.json({ success: true, hash: p.revenue_split_hash, approvedAt: p.revenue_split_approved_at });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
