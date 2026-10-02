import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const qs = request.nextUrl.searchParams.toString();
    const path = qs ? `/api/v1/admin/suggestions?${qs}` : '/api/v1/admin/suggestions';
    const r = await callOdooAPI(path, { method: 'GET', headers: { Authorization: auth } });
    return NextResponse.json(r.data);
  } catch (e: any) {
    const msg = String(e?.message || 'Odoo non raggiungibile');
    const m = msg.match(/ha risposto (\d{3})/);
    return NextResponse.json({ error: msg }, { status: m ? parseInt(m[1], 10) : 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.text() || '{}';
    const r = await callOdooAPI('/api/v1/admin/suggestions/scan', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body,
    });
    return NextResponse.json(r.data);
  } catch (e: any) {
    const msg = String(e?.message || 'Odoo non raggiungibile');
    const m = msg.match(/ha risposto (\d{3})/);
    return NextResponse.json({ error: msg }, { status: m ? parseInt(m[1], 10) : 502 });
  }
}
