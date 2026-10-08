import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

export async function PATCH(
  request: NextRequest,
  ctx: { params: { id: string; lineId: string } },
) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const headers: Record<string, string> = {
      Authorization: auth, 'Content-Type': 'application/json',
    };
    if (SYSTEM_CONFIG.ODOO.API_KEY) headers['X-API-Key'] = SYSTEM_CONFIG.ODOO.API_KEY;
    const r = await fetch(
      `${base}/api/v1/admin/credit-portfolios/${ctx.params.id}/line/${ctx.params.lineId}`,
      { method: 'PATCH', headers, body: JSON.stringify(body) },
    );
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
