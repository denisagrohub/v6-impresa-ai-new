import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 04/10/2026 (C5-h): proxy verso /api/v1/admin/andon/report.
function forwardGatewayError(e: any) {
  const msg = String(e?.message || 'Odoo non raggiungibile');
  const m = msg.match(/ha risposto (\d{3})/);
  return NextResponse.json({ error: msg }, { status: m ? parseInt(m[1], 10) : 502 });
}

export async function POST(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json();
    const r = await callOdooAPI('/api/v1/admin/andon/report', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(r.data);
  } catch (e: any) { return forwardGatewayError(e); }
}
