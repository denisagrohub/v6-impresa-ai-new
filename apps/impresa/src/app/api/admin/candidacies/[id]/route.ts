import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.partnership.candidacy', 'unlink', [[id]]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 }); }
  const { state } = body || {};
  if (!state) return NextResponse.json({ success: false, error: 'state obbligatorio' }, { status: 400 });
  try {
    await odoo.connect();
    await odoo.execute('erpv6.partnership.candidacy', 'write', [[id], { state }]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}
