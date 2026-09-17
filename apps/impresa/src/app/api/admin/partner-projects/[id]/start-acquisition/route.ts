import { NextRequest, NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ success: false, error: 'Nome obbligatorio' }, { status: 400 });
    const emailAlias = (body.emailAlias || '').trim() || null;

    const result = await odoo.execute(
      'erpv6.tracking.relation',
      'action_start_acquisition',
      [id, name, emailAlias]
    );

    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    console.error('start-acquisition error:', e);
    return NextResponse.json({ success: false, error: e.message || 'Errore' }, { status: 500 });
  }
}
