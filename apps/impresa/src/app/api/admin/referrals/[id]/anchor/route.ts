import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/referrals/[id]/anchor — ancora su OpenTimestamps
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.referral', 'action_anchor_blockchain', [[id]]);
    const [rec] = await odoo.execute('erpv6.referral', 'read', [[id], ['blockchain_record_id']]);
    return NextResponse.json({ success: true, blockchainRecordId: Array.isArray(rec.blockchain_record_id) ? rec.blockchain_record_id[0] : null });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
