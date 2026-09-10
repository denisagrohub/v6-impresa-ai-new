import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "crea documenti... dovrebbe farmi vedere la bozza") -
// scarica il PDF reale di un erpv6.contract.document (content/file_name,
// Binary/base64), stesso pattern di /api/admin/documents/[id]/download ma
// su un modello diverso (erpv6.contract.document ha il proprio schema di
// storage file, vedi commento in production_order.py).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const docs = await odoo.execute('erpv6.contract.document', 'search_read', [
      [['id', '=', id]], ['content', 'file_name', 'name'],
    ]);
    const doc = docs && docs[0];
    if (!doc || !doc.content) {
      return NextResponse.json({ success: false, error: 'Documento non trovato o senza PDF generato' }, { status: 404 });
    }
    const buffer = Buffer.from(doc.content, 'base64');
    const fileName = doc.file_name || `${doc.name || 'documento'}.pdf`;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/contract-documents/[id]/download:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
