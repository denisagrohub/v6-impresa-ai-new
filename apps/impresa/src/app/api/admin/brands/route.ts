import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function GET() {
  try {
    await odoo.connect();
    const brands = await odoo.execute('erpv6.consulting.brand', 'search_read', [
      [['active', '=', true]], ['id', 'name', 'default_hourly_rate', 'default_commission_rate'],
    ]);
    return NextResponse.json({ success: true, brands: brands || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
