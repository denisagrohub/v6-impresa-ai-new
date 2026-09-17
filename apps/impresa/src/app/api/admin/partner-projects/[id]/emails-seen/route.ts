import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 14/09/2026: marca le email del progetto come viste ORA. Il workbench
// lo chiama al primo caricamento: le email arrivate PRIMA di questo
// istante non sono piu' "nuove" (highlight ambra spento, badge azzerato).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const projectId = parseInt((await params).id, 10);
  if (!projectId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const rec = await odoo.execute('erpv6.tracking.relation', 'read', [[projectId], ['parent_id']]);
    const rootId = rec?.[0]?.parent_id ? rec[0].parent_id[0] : projectId;
    await odoo.execute('erpv6.tracking.relation', 'write', [[rootId], { x_v6_emails_seen_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}
