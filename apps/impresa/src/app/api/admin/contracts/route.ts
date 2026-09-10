import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

const DOC_TYPE_LABELS: Record<string, string> = {
  nda: 'NDA', service: 'Contratto', promise_to_pay: 'Promessa di Pagamento',
  terms: 'Termini', privacy: 'Privacy', custom: 'Custom',
};

// 10/09/2026 (Denis: "vedi come collegare il modulo contratti"): vista
// reale su erpv6.contract (Typst + firma Documenso + certificazione
// blockchain, gia' tutto reale) - NON spostato dentro erpv6.library.document
// di proposito, vedi commento in production_order.py._generate_contract_document_pdf
// ("erpv6.contract.document ha gia' il proprio schema di storage file").
export async function GET() {
  try {
    await odoo.connect();

    const contracts = await odoo.execute('erpv6.contract', 'search_read', [
      [], ['id', 'name', 'partner_id', 'project_id', 'status', 'signed_at', 'is_certified', 'document_ids'], 0, 100, 'id desc',
    ]);

    const allDocIds = Array.from(new Set((contracts || []).flatMap((c: any) => c.document_ids || [])));
    const docs = allDocIds.length
      ? await odoo.execute('erpv6.contract.document', 'search_read', [
          [['id', 'in', allDocIds]], ['id', 'contract_id', 'doc_type', 'file_name', 'is_certified', 'signed_at'],
        ])
      : [];
    const docsByContract = new Map<number, any[]>();
    for (const d of docs || []) {
      const cid = Array.isArray(d.contract_id) ? d.contract_id[0] : d.contract_id;
      if (!docsByContract.has(cid)) docsByContract.set(cid, []);
      docsByContract.get(cid)!.push({
        id: d.id,
        tipo: DOC_TYPE_LABELS[d.doc_type] || d.doc_type,
        fileName: d.file_name || null,
        certificato: d.is_certified,
        firmatoIl: d.signed_at || null,
      });
    }

    return NextResponse.json({
      success: true,
      contracts: (contracts || []).map((c: any) => ({
        id: c.id,
        nome: c.name,
        cliente: Array.isArray(c.partner_id) ? c.partner_id[1] : '—',
        stato: c.status,
        certificato: c.is_certified,
        firmatoIl: c.signed_at || null,
        documenti: docsByContract.get(c.id) || [],
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/contracts:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
