import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 13/10/2026 (C-orchestrator-1): carica sorgente Typst per un doc_type
// senza template di sistema e genera subito il documento. Riusa
// action_upload_contract_template di erpv6_relation_documents.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const docType = body?.docType;
  const typstSource = body?.typstSource;
  if (!docType || !typstSource) {
    return NextResponse.json(
      { success: false, error: 'docType e typstSource obbligatori' },
      { status: 400 },
    );
  }

  try {
    await odoo.connect();
    const result = await odoo.execute(
      'erpv6.tracking.relation',
      'action_upload_contract_template',
      [[id], docType, typstSource],
    );
    return NextResponse.json({
      success: true,
      documentId: result?.document_id || null,
      hasPdf: !!result?.has_pdf,
      templateMissing: !!result?.template_missing,
    });
  } catch (error: any) {
    console.error('❌ Errore POST relations/[id]/documents/upload-template:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Caricamento fallito' },
      { status: 502 },
    );
  }
}
