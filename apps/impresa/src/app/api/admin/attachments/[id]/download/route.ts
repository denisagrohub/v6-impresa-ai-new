import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const rows = await odoo.execute('ir.attachment', 'search_read', [
      [['id', '=', id]], ['datas', 'name', 'mimetype'],
    ]);
    const doc = rows && rows[0];
    if (!doc || !doc.datas) {
      return NextResponse.json({ success: false, error: 'Documento non trovato' }, { status: 404 });
    }
    const buffer = Buffer.from(doc.datas, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.mimetype || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.name}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/attachments/[id]/download:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
