// GET /api/admin/access-requests[?all=1] — lista richieste accesso playbook.
import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';
import { requirePermission } from '@erpv6/auth';

export async function GET(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const perm = requirePermission(request, ['admin', 'chief_projects']);
  if (perm instanceof NextResponse) return perm;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const qs = request.nextUrl.search || '';
    const result = await callOdooAPI(`/api/v1/admin/access-requests${qs}`, {
      method: 'GET', headers: { Authorization: authHeader },
    });
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
