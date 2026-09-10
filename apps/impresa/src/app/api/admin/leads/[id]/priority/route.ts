import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "un'azione importante che colora il lead di giallo o
// arancio") - riusa il campo priority NATIVO di crm.lead (mai usato in
// questo progetto finora), non un campo nuovo. '0'=normale, '1'=giallo
// (da monitorare), '2'=arancio (urgente).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { priority } = body || {};
  if (!['0', '1', '2', '3'].includes(String(priority))) {
    return NextResponse.json({ success: false, error: 'priority non valida' }, { status: 400 });
  }

  try {
    await odoo.connect();
    await odoo.execute('crm.lead', 'write', [[id], { priority: String(priority) }]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore PATCH leads/[id]/priority:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Aggiornamento fallito' }, { status: 502 });
  }
}
