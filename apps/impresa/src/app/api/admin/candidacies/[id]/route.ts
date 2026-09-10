import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "clicco sopra e me la fa vedere sotto... ma dovrei
// avere la possibilità di fare alcune azioni... o eliminarla").
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    await odoo.execute('erpv6.partnership.candidacy', 'unlink', [[id]]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore DELETE /api/admin/candidacies/[id]:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Eliminazione fallita' }, { status: 502 });
  }
}
