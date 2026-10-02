import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 02/10/2026 (C2-rd): chi ha letto un'email di progetto (solo admin/chief).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const qs = request.nextUrl.searchParams.toString();
    const path = qs
      ? `/api/v1/admin/emails/${params.id}/readers?${qs}`
      : `/api/v1/admin/emails/${params.id}/readers`;
    const result = await callOdooAPI(path, { method: 'GET', headers: { Authorization: authHeader } });
    return NextResponse.json(result.data);
  } catch (error: any) {
    const msg = String(error?.message || 'Odoo non raggiungibile');
    const m = msg.match(/ha risposto (\d{3})/);
    const status = m ? parseInt(m[1], 10) : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
