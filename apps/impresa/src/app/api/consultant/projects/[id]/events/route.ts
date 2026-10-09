import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

// 09/10/2026 (C-email-project-1-fix1): proxy timeline events
// consultant. Parallelo a /api/admin/relations/[id]/events.
// Pattern fetch diretto (C-kb-3b-fix).
export async function GET(
  request: NextRequest,
  ctx: { params: { id: string } },
) {
  if (!isOdooEnabled()) {
    return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  }
  try {
    const base = (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(SYSTEM_CONFIG.ODOO.API_KEY ? { 'X-API-Key': SYSTEM_CONFIG.ODOO.API_KEY } : {}),
      Authorization: auth,
    };
    const target = `${base}/api/v1/consultant/projects/${ctx.params.id}/events`;
    const r = await fetch(target, { method: 'GET', headers });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
