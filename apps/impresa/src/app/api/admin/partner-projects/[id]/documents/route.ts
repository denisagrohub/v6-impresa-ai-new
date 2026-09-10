import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "manca sui progetti partner la possibilità di
// upload documenti") - erpv6.tracking.relation non ha nessun crm.lead
// collegato, quindi erpv6.library.document (project_id required su
// crm.lead) non è utilizzabile qui senza una migrazione di schema
// (bloccata da un problema di ambiente sul server, vedi commit).
// ir.attachment nativo di Odoo risolve lo stesso bisogno reale (allegare
// un file a un record) senza nessun campo aggiuntivo: polimorfico
// out-of-the-box su res_model/res_id, stesso meccanismo che Odoo usa
// già per ogni allegato del sistema.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const attachments = await odoo.execute('ir.attachment', 'search_read', [
      [['res_model', '=', 'erpv6.tracking.relation'], ['res_id', '=', id]],
      ['id', 'name', 'mimetype', 'file_size', 'create_date'], 0, 100, 'create_date desc',
    ]);
    return NextResponse.json({ success: true, documents: attachments || [] });
  } catch (error: any) {
    console.error('❌ Errore GET partner-projects/[id]/documents:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { fileBase64, fileName, mimetype } = body || {};
  if (!fileBase64 || !fileName) {
    return NextResponse.json({ success: false, error: 'File obbligatorio' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const attachmentId = await odoo.execute('ir.attachment', 'create', [{
      name: fileName,
      res_model: 'erpv6.tracking.relation',
      res_id: id,
      datas: fileBase64,
      mimetype: mimetype || 'application/octet-stream',
    }]);
    return NextResponse.json({ success: true, documentId: attachmentId });
  } catch (error: any) {
    console.error('❌ Errore POST partner-projects/[id]/documents:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Caricamento fallito' }, { status: 502 });
  }
}
