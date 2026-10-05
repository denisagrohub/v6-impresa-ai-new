import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled } from '@/config/system';

// 05/10/2026 (C-crediti-1c-fix): proxy PDF binario (streaming, no JSON).
// L'API Odoo ritorna application/pdf con Content-Disposition inline.
export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });

  const odooBase = process.env.ODOO_BASE_URL || process.env.NEXT_PUBLIC_ODOO_BASE_URL || 'http://odoo:8069';
  try {
    const r = await fetch(`${odooBase}/api/v1/admin/credit-portfolios/${ctx.params.id}/pdf`, {
      headers: { Authorization: auth },
    });
    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ error: txt }, { status: r.status });
    }
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': r.headers.get('content-disposition') || 'inline',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'errore') }, { status: 502 });
  }
}
