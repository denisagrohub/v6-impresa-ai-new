import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Riusa action_marca_incassata() gia' reale (erpv6_production) - stesso
// gate Responsabile/Admin gia' applicato lato Odoo, nessuna nuova logica
// di conferma incasso qui.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    await odoo.execute('erpv6.production.order.tranche', 'action_marca_incassata', [[id]]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore POST tranches/[id]/mark-paid:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Operazione fallita' }, { status: 502 });
  }
}
