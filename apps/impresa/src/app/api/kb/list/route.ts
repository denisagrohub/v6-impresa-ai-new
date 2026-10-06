import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

function fwError(e: any) {
  const msg = String(e?.message || 'Odoo non raggiungibile');
  const m = msg.match(/ha risposto (\d{3})/);
  return NextResponse.json({ error: msg }, { status: m ? parseInt(m[1], 10) : 502 });
}

export async function GET(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const kbSession = request.headers.get('x-kb-session');
    const qs = request.nextUrl.searchParams.toString();
    const path = qs ? `/api/v1/kb/articles?${qs}` : '/api/v1/kb/articles';
    const headers: Record<string, string> = { Authorization: auth };
    if (kbSession) headers['X-Kb-Session'] = kbSession;
    const r = await callOdooAPI(path, { method: 'GET', headers });
    return NextResponse.json(r);
  } catch (e: any) { return fwError(e); }
}
