import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/referrals/[id]/send-to-sign
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.referral', 'action_send_agreement_to_sign', [[id]]);
    const [r] = await odoo.execute('erpv6.referral', 'read', [[id], ['accordo_url', 'accordo_documenso_id', 'state']]);
    return NextResponse.json({
      success: true,
      accordoUrl: r.accordo_url,
      documensoId: r.accordo_documenso_id,
      state: r.state,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Errore invio firma' }, { status: 502 });
  }
}
