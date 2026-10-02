import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// POST /api/admin/suggestions/<id>/accept|ignore
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  const url = request.nextUrl;
  const action = url.searchParams.get('action') || 'accept';
  try {
    const r = await callOdooAPI(`/api/v1/admin/suggestions/${params.id}/${action}`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return NextResponse.json(r.data);
  } catch (e: any) {
    const msg = String(e?.message || 'Odoo non raggiungibile');
    const m = msg.match(/ha risposto (\d{3})/);
    return NextResponse.json({ error: msg }, { status: m ? parseInt(m[1], 10) : 502 });
  }
}
