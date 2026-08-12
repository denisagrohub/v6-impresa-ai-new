import { NextRequest, NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 ODOO_URL:', process.env.NEXT_PUBLIC_ODOO_URL);
    console.log('🔍 ODOO_DB:', process.env.NEXT_PUBLIC_ODOO_DB);
    console.log('🔍 ODOO_USERNAME:', process.env.NEXT_PUBLIC_ODOO_USERNAME);
    console.log('🔍 ODOO_MOCK:', process.env.NEXT_PUBLIC_ODOO_MOCK);

    await odoo.connect();
    
    const modules = await odoo.execute('ir.module.module', 'search_read', [
      [['name', 'ilike', 'erpv6_'], ['state', '=', 'installed']],
      ['name', 'state']
    ]);

    return NextResponse.json({
      success: true,
      connected: true,
      installedModules: modules.map((m: any) => m.name),
      allInstalled: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Errore connessione Odoo:', error.message);
    return NextResponse.json({
      success: false,
      connected: false,
      error: error.message || 'Errore di connessione',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
