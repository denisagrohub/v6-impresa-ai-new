import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token) return NextResponse.json({ success: false, error: 'Token mancante' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await odoo.connect();
    const tokens = await odoo.execute('erpv6.booking.token', 'search_read', [
      [['confirmation_token', '=', token]], ['id'], 0, 1,
    ]);
    const booking = tokens && tokens[0];
    if (!booking) return NextResponse.json({ success: false, error: 'Link non valido' }, { status: 404 });

    await odoo.execute('erpv6.booking.token', 'action_client_request_change', [[booking.id], body.note || false]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore reschedule:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Operazione fallita' }, { status: 502 });
  }
}
