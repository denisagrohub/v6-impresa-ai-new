import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "crea documenti, e poi scegliere tra i template dei
// documenti nda contratto ncnd") - riusa action_generate_contract_document
// gia' reale (erpv6_production): idempotente per doc_type, genera il PDF
// con lo stesso motore Typst dei gate automatici NDA/contratto.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const docType = body.docType;
  if (!docType) return NextResponse.json({ success: false, error: 'docType mancante' }, { status: 400 });

  try {
    await odoo.connect();
    const result = await odoo.execute('erpv6.production.order', 'action_generate_contract_document', [[id], docType]);
    return NextResponse.json({
      success: true,
      documentId: result?.document_id || null,
      hasPdf: !!result?.has_pdf,
      templateMissing: !!result?.template_missing,
    });
  } catch (error: any) {
    console.error('❌ Errore POST projects/[id]/documents:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
