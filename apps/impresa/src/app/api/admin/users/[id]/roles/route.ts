// GET  /api/admin/users/[id]/roles — leggi ruoli utente
// PUT  /api/admin/users/[id]/roles — aggiorna ruoli utente (solo admin)
import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';
import { requirePermission } from '@erpv6/auth';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const permissionCheck = requirePermission(request, ['admin']);
  if (permissionCheck instanceof NextResponse) return permissionCheck;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const result = await callOdooAPI(`/api/v1/admin/users/${params.id}/roles`, {
      method: 'GET',
      headers: { Authorization: authHeader },
    });
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const permissionCheck = requirePermission(request, ['admin']);
  if (permissionCheck instanceof NextResponse) return permissionCheck;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const body = await request.json();
    const result = await callOdooAPI(`/api/v1/admin/users/${params.id}/roles`, {
      method: 'PUT',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
