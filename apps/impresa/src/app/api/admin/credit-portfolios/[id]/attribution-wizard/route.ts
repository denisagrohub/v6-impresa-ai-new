import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 05/10/2026 (C-attribution-1e): proxy per modale attribuzione in Next.
function fwError(e: any) {
  const msg = String(e?.message || 'Odoo non raggiungibile');
  const m = msg.match(/ha risposto (\d{3})/);
  return NextResponse.json({ error: msg }, { status: m ? parseInt(m[1], 10) : 502 });
}

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const r = await callOdooAPI(
      `/api/v1/admin/credit-portfolios/${ctx.params.id}/attribution-wizard`,
      { method: 'GET', headers: { Authorization: auth } },
    );
    return NextResponse.json(r);
  } catch (e: any) { return fwError(e); }
}

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json();
    const r = await callOdooAPI(
      `/api/v1/admin/credit-portfolios/${ctx.params.id}/attribution-wizard`,
      {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json(r);
  } catch (e: any) { return fwError(e); }
}
