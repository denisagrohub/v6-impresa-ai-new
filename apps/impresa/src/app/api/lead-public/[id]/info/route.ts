import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

// 08/10/2026 (C-security-lead-public-bis): proxy per pre-popolare il
// form /lead/<id>/edit. Inoltra X-Lead-Token.
export async function GET(
  request: NextRequest,
  ctx: { params: { id: string } },
) {
  if (!isOdooEnabled()) {
    return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  }
  const leadToken = request.headers.get('x-lead-token');
  if (!leadToken) {
    return NextResponse.json({ error: 'Token mancante' }, { status: 401 });
  }
  try {
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(SYSTEM_CONFIG.ODOO.API_KEY ? { 'X-API-Key': SYSTEM_CONFIG.ODOO.API_KEY } : {}),
      'X-Lead-Token': leadToken,
    };
    const r = await fetch(
      `${base}/api/v1/leads/${ctx.params.id}/public`,
      { method: 'GET', headers },
    );
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
