import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 14/09/2026: il workbench non mostrava il flusso email REALE gia'
// gestito da Odoo (catch-all v6sviluppoimpresa.it -> fetchmail ->
// erpv6.project.email.log, con match_status e direction). Qui leggiamo
// quel log per il progetto: radice = progetto, cosi' arrivano anche le
// email collegate alle PARTI (relation_id figlie della radice).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const projectId = parseInt((await params).id, 10);
  if (!projectId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    // radice del progetto: l'alias vale sulla radice, ma le parti figlie
    // scrivono sullo stesso filone -> matchiamo radice+discendenti via
    // parent path: v1 semplice = leggo il log del progetto e delle sue
    // relazioni dirette (relation_id in root + figli).
    const root = await odoo.execute('erpv6.tracking.relation', 'read', [[projectId], ['id', 'parent_id']]);
    const rec = root?.[0];
    if (!rec) return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    // se sono gia' su una parte, risalgo alla radice
    const rootId = rec.parent_id ? rec.parent_id[0] : rec.id;
    const children = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', rootId]], ['id'], 0, 200,
    ]);
    const ids = [rootId, ...(children || []).map((c: any) => c.id)];

    const emails = await odoo.execute('erpv6.project.email.log', 'search_read', [
      [['relation_id', 'in', ids]],
      ['id', 'name', 'sender_email', 'recipient_emails', 'cc_emails', 'direction',
       'match_status', 'matched_alias', 'relation_id', 'recipient_relation_id', 'create_date'],
      0, 50,
    ]);
    return NextResponse.json({
      success: true,
      emails: (emails || []).map((e: any) => ({
        ...e,
        projectName: e.relation_id ? e.relation_id[1] : null,
        recipientName: e.recipient_relation_id ? e.recipient_relation_id[1] : null,
      })),
    });
  } catch (error: any) {
    console.error('❌ emails:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore' }, { status: 502 });
  }
}
