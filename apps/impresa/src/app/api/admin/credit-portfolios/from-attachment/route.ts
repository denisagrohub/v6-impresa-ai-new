import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

// 09/10/2026 (C-crediti-4): proxy crea portfolio da PDF caricato.
export async function POST(request: NextRequest) {
  if (!isOdooEnabled()) {
    return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(SYSTEM_CONFIG.ODOO.API_KEY ? { 'X-API-Key': SYSTEM_CONFIG.ODOO.API_KEY } : {}),
      Authorization: auth,
    };
    const r = await fetch(
      `${base}/api/v1/admin/credit-portfolios/from-attachment`,
      { method: 'POST', headers, body: JSON.stringify(body) },
    );
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
