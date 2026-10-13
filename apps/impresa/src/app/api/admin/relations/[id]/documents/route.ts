import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 13/10/2026 (C-orchestrator-1): genera documento contrattuale su
// tracking.relation (NDA, NCND, ...). Riusa action_generate_contract_document
// di erpv6_relation_documents — stesso motore Typst dei gate automatici,
// idempotente per doc_type. Ritorna {documentId, hasPdf, templateMissing}.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const docType = body?.docType;
  if (!docType) return NextResponse.json({ success: false, error: 'docType mancante' }, { status: 400 });

  try {
    await odoo.connect();
    const result = await odoo.execute(
      'erpv6.tracking.relation',
      'action_generate_contract_document',
      [[id], docType],
    );
    return NextResponse.json({
      success: true,
      documentId: result?.document_id || null,
      hasPdf: !!result?.has_pdf,
      templateMissing: !!result?.template_missing,
    });
  } catch (error: any) {
    console.error('❌ Errore POST relations/[id]/documents:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Creazione fallita' },
      { status: 502 },
    );
  }
}
