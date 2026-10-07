import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

export async function POST(
  request: NextRequest,
  ctx: { params: { id: string } },
) {
  if (!isOdooEnabled()) {
    return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const kbSession = request.headers.get('x-kb-session');
    const url = SYSTEM_CONFIG.ODOO.URL.replace(/\/$/, '');
    const apiKey = SYSTEM_CONFIG.ODOO.API_KEY;
    const target = `${url}/api/v1/kb/articles/${ctx.params.id}/publish`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      'Authorization': auth,
    };
    if (kbSession) headers['X-Kb-Session'] = kbSession;

    const r = await fetch(target, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
