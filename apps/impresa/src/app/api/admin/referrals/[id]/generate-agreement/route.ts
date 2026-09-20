import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/referrals/[id]/generate-agreement
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.referral', 'action_generate_agreement', [[id]]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Errore generazione' }, { status: 502 });
  }
}
