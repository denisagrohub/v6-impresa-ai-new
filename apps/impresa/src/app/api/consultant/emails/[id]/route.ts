import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

// 09/10/2026 (C-email-project-1-fix1): migrato da callOdooAPI a
// fetch diretto. Preserva status + body JSON su 4xx.
// Usato dalla modale EmailPreviewModal in timeline consultant.

function buildHeaders(auth: string, withJson = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: auth };
  if (SYSTEM_CONFIG.ODOO.API_KEY) h['X-API-Key'] = SYSTEM_CONFIG.ODOO.API_KEY;
  if (withJson) h['Content-Type'] = 'application/json';
  return h;
}

function baseUrl(): string {
  return (SYSTEM_CONFIG.ODOO.URL || '').replace(/\/$/, '');
}

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
    const qs = request.nextUrl.search || '';
    const target = `${baseUrl()}/api/v1/consultant/emails/${ctx.params.id}${qs}`;
    const r = await fetch(target, { method: 'GET', headers: buildHeaders(auth) });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}

export async function DELETE(
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
    const qs = request.nextUrl.search || '';
    const target = `${baseUrl()}/api/v1/consultant/emails/${ctx.params.id}${qs}`;
    const r = await fetch(target, { method: 'DELETE', headers: buildHeaders(auth) });
    const data = await r.json().catch(() => ({ error: 'Risposta non JSON' }));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
