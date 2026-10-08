import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

function buildHeaders(auth: string, withJson = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: auth };
  if (SYSTEM_CONFIG.ODOO.API_KEY) h['X-API-Key'] = SYSTEM_CONFIG.ODOO.API_KEY;
  if (withJson) h['Content-Type'] = 'application/json';
  return h;
}

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const r = await fetch(
      `${base}/api/v1/admin/credit-portfolios/${ctx.params.id}/attribution-wizard`,
      { method: 'GET', headers: buildHeaders(auth) },
    );
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const r = await fetch(
      `${base}/api/v1/admin/credit-portfolios/${ctx.params.id}/attribution-wizard`,
      { method: 'POST', headers: buildHeaders(auth, true), body: JSON.stringify(body) },
    );
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
