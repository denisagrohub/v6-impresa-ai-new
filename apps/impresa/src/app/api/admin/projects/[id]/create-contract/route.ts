import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Riusa action_create_contract() gia' reale (erpv6_production) - stessa
// logica di risoluzione cliente e creazione contratto gia' usata
// dall'azione manuale lato Odoo, nessuna duplicazione qui.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const result = await odoo.execute('erpv6.production.order', 'action_create_contract', [[id]]);
    return NextResponse.json({ success: true, contractId: result?.res_id || null });
  } catch (error: any) {
    console.error('❌ Errore POST create-contract:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
