import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "il documento creato" deve essere visibile nel
// progetto) - scarica il file reale (erpv6.library.document.file,
// Binary/base64) invece di mostrare solo il nome.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const docs = await odoo.execute('erpv6.library.document', 'search_read', [
      [['id', '=', id]], ['file', 'file_name', 'name'],
    ]);
    const doc = docs && docs[0];
    if (!doc || !doc.file) {
      return NextResponse.json({ success: false, error: 'Documento non trovato o senza file' }, { status: 404 });
    }
    const buffer = Buffer.from(doc.file, 'base64');
    const fileName = doc.file_name || `${doc.name || 'documento'}.pdf`;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/documents/[id]/download:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
