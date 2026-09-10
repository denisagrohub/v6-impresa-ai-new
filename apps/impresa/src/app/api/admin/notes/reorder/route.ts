import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "posso modificare l'ordine prendendoli con il
// mouse"): riusa erpv6.project.note.reorder() - riscrive sequence in
// base al nuovo ordine trascinato lato frontend.
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { orderedIds } = body || {};
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return NextResponse.json({ success: false, error: 'orderedIds obbligatorio' }, { status: 400 });
  }

  try {
    await odoo.connect();
    await odoo.execute('erpv6.project.note', 'reorder', [orderedIds]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/notes/reorder:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Riordino fallito' }, { status: 502 });
  }
}
