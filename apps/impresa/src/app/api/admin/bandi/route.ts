// GET /api/admin/bandi
// Proxy verso il gateway Odoo /api/v1/bandi/active.
// Ritorna lista bandi attivi con match count + best score.
// Step 4 (permessi): accessibile a admin + chief_bandi.
import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';
import { requirePermission } from '@erpv6/auth';

export async function GET(request: NextRequest) {
  if (!isOdooEnabled()) {
    return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  }
  const permissionCheck = requirePermission(request, ['admin', 'chief_bandi']);
  if (permissionCheck instanceof NextResponse) {
    return permissionCheck;
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  }
  try {
    const result = await callOdooAPI('/api/v1/bandi/active', {
      method: 'GET',
      headers: { Authorization: authHeader },
    });
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
