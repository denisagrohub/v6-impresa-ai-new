import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 13/10/2026 (C-orchestrator-1 STEP B): albero relation (progetti + discendenti).
export async function GET(request: NextRequest) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const auth = request.headers.get('authorization');
  if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const result = await callOdooAPI('/api/v1/admin/relations/tree', {
      method: 'GET',
      headers: { Authorization: auth },
    });
    return NextResponse.json(result.data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 502 });
  }
}
