import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Slot di prenotazione (erpv6.booking.token) per il consulente - riusa
// generate_bulk() gia' reale e verificato (stesso metodo dietro
// /api/v1/booking/generate usato dal self-service consulente, qui
// chiamato lato admin per conto di qualunque consulente via JSON-RPC).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const consultantId = parseInt(params.id, 10);
  if (!consultantId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const tokens = await odoo.execute('erpv6.booking.token', 'search_read', [
      [['consultant_id', '=', consultantId]],
      ['id', 'token', 'status', 'expires_at', 'client_name', 'booked_at'],
      0, 100, 'id desc',
    ]);
    return NextResponse.json({ success: true, tokens: tokens || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const consultantId = parseInt(params.id, 10);
  if (!consultantId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const count = Math.min(Number(body?.count) || 10, 50);
  const validityHours = Number(body?.validityHours) || 24;

  try {
    await odoo.connect();
    await odoo.execute('erpv6.booking.token', 'generate_bulk', [consultantId, count, validityHours]);
    const tokens = await odoo.execute('erpv6.booking.token', 'search_read', [
      [['consultant_id', '=', consultantId]],
      ['id', 'token', 'status', 'expires_at', 'client_name', 'booked_at'],
      0, 100, 'id desc',
    ]);
    return NextResponse.json({ success: true, tokens: tokens || [] });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/consultants/[id]/slots:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Generazione fallita' }, { status: 502 });
  }
}
