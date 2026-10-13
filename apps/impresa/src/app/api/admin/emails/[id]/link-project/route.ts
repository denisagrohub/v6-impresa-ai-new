import { NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 13/10/2026 (C-orchestrator-1 STEP B): link esplicito email->progetto.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  try {
    const result = await callOdooAPI(`/api/v1/admin/emails/${params.id}/link-project`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result.data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const result = await callOdooAPI(`/api/v1/admin/emails/${params.id}/link-project`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });
    return NextResponse.json(result.data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 502 });
  }
}
