// ═══════════════════════════════════════════════════════════════════
// POST /api/admin/deals/[id]/recompute
// Proxy verso il gateway Odoo /api/v1/admin/deals/<id>/recompute.
// Rigenera il prospetto di un deal in forecasting/negotiating.
// Su deal congelati/firmati il gateway risponde 400 con errore esplicito.
// Aggiunto il 29/09/2026 (Refactor C — fix Rigenera chiamava /freeze).
// ═══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const result = await callOdooAPI(`/api/v1/admin/deals/${params.id}/recompute`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
