import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 01/10/2026 (C1a-2b): proxy PATCH/DELETE verso /api/v1/admin/todos/<id>.

function forwardGatewayError(e: any) {
  const msg = String(e?.message || 'Odoo non raggiungibile');
  const m = msg.match(/ha risposto (\d{3})/);
  const status = m ? parseInt(m[1], 10) : 502;
  return NextResponse.json({ error: msg }, { status });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json();
    const r = await callOdooAPI(`/api/v1/admin/todos/${params.id}`, {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(r.data);
  } catch (e: any) {
    return forwardGatewayError(e);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const r = await callOdooAPI(`/api/v1/admin/todos/${params.id}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });
    return NextResponse.json(r.data);
  } catch (e: any) {
    return forwardGatewayError(e);
  }
}
