import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "se non ci sono un pulsante che carichi template
// typst") - riusa action_upload_contract_template gia' reale
// (erpv6_production): crea un erpv6.typst.template vero per il doc_type
// scelto (es. NCND, che non ha ancora un template di sistema) e genera
// subito il documento con quel template.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { docType, typstSource, name } = body;
  if (!docType || !typstSource) {
    return NextResponse.json({ success: false, error: 'docType e typstSource sono richiesti' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const result = await odoo.execute('erpv6.production.order', 'action_upload_contract_template', [[id], docType, typstSource, name || undefined]);
    return NextResponse.json({
      success: true,
      documentId: result?.document_id || null,
      hasPdf: !!result?.has_pdf,
      templateMissing: !!result?.template_missing,
    });
  } catch (error: any) {
    console.error('❌ Errore POST projects/[id]/documents/upload-template:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Caricamento template fallito' }, { status: 502 });
  }
}
