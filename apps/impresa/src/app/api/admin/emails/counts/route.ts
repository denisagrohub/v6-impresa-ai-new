import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 02/10/2026 (C2): proxy conteggio email non lette per dashboard.
function forwardGatewayError(e: any) {
  const msg = String(e?.message || 'Odoo non raggiungibile');
  const m = msg.match(/ha risposto (\d{3})/);
  const status = m ? parseInt(m[1], 10) : 502;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const r = await callOdooAPI('/api/v1/admin/emails/counts', {
      method: 'GET', headers: { Authorization: auth },
    });
    return NextResponse.json(r.data);
  } catch (e: any) {
    return forwardGatewayError(e);
  }
}
