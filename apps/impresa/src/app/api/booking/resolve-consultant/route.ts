import { NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 10/09/2026 (Denis, sulle 8 pagine pubbliche che linkavano tutte
// "/booking/1" scritto a mano: "deve andare ad un qualsiasi altro
// consulente diverso da me solo se io non ho slot") - proxy pubblico
// verso /api/v1/booking/resolve-consultant (erpv6_api_gateway), usato da
// /booking/page.tsx per scegliere il consulente al volo invece di un id
// fisso nel frontend.
export async function GET() {
  if (!isOdooEnabled()) {
    return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  }
  try {
    const result = await callOdooAPI('/api/v1/booking/resolve-consultant', { method: 'GET' });
    return NextResponse.json({ consultantId: result.data.consultant_id });
  } catch (error: any) {
    console.error('Errore /api/booking/resolve-consultant:', error);
    return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
  }
}
