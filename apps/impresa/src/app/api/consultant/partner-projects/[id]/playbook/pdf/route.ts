import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled } from '@/config/system';

// 05/10/2026 (C-playbook-3a): proxy PDF binario del playbook.
const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://erp.v6sviluppoimpresa.it';

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const url = `${ODOO_URL.replace(/\/$/, '')}/api/v1/consultant/projects/${ctx.params.id}/playbook/pdf`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ error: txt.slice(0, 300) }, { status: r.status });
    }
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': r.headers.get('content-disposition') || 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'errore') }, { status: 502 });
  }
}
