import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "manca sui progetti la possibilità di upload
// documenti") - erpv6.library.document.project_id (crm.lead) esiste già
// e production_order.lead_id è sempre un crm.lead reale, quindi qui basta
// crearlo direttamente (a differenza di erpv6.tracking.relation, che non
// ha nessun crm.lead - vedi source_model/source_res_id per quel caso).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { name, category, fileBase64, fileName } = body || {};
  if (!name || !fileBase64) {
    return NextResponse.json({ success: false, error: 'Nome e file sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const orders = await odoo.execute('erpv6.production.order', 'search_read', [
      [['id', '=', id]], ['lead_id'],
    ]);
    const order = orders && orders[0];
    if (!order) return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    const leadId = Array.isArray(order.lead_id) ? order.lead_id[0] : null;

    const docId = await odoo.execute('erpv6.library.document', 'create', [{
      name,
      category: category || 'other',
      origin: 'internal_upload',
      project_id: leadId,
      source_model: 'erpv6.production.order',
      source_res_id: id,
      file: fileBase64,
      file_name: fileName || 'documento',
    }]);

    return NextResponse.json({ success: true, documentId: docId });
  } catch (error: any) {
    console.error('❌ Errore POST projects/[id]/documents/upload-file:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Caricamento fallito' }, { status: 502 });
  }
}
