// GET /api/admin/deals/[id]/access-log
// Chi ha aperto/modificato questo deal (audit GDPR). C5.4.
import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const result = await callOdooAPI(
      `/api/v1/admin/deals/${params.id}/access-log`,
      { method: 'GET', headers: { Authorization: authHeader } },
    );
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
