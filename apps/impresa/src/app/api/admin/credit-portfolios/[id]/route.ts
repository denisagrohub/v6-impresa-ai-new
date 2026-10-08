import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

// 07/10/2026 (C-security-audit 3a-front): fetch diretto + preserve
// status. Il proxy vecchio (callOdooAPI) lanciava su 403 e il
// frontend vedeva "Odoo API ... ha risposto 403" invece di
// "Accesso negato".

function getBase() {
  return (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
}

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const url = `${getBase()}/api/v1/admin/credit-portfolios/${ctx.params.id}`;
    const headers: Record<string, string> = { Authorization: auth };
    if (SYSTEM_CONFIG.ODOO.API_KEY) headers['X-API-Key'] = SYSTEM_CONFIG.ODOO.API_KEY;
    const r = await fetch(url, { method: 'GET', headers });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const url = `${getBase()}/api/v1/admin/credit-portfolios/${ctx.params.id}`;
    const headers: Record<string, string> = {
      Authorization: auth, 'Content-Type': 'application/json',
    };
    if (SYSTEM_CONFIG.ODOO.API_KEY) headers['X-API-Key'] = SYSTEM_CONFIG.ODOO.API_KEY;
    const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
