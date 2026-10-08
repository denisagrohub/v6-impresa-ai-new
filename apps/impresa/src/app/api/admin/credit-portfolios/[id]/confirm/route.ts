import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const headers: Record<string, string> = { Authorization: auth };
    if (SYSTEM_CONFIG.ODOO.API_KEY) headers['X-API-Key'] = SYSTEM_CONFIG.ODOO.API_KEY;
    const r = await fetch(`${base}/api/v1/admin/credit-portfolios/${ctx.params.id}/confirm`, {
      method: 'POST', headers,
    });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
