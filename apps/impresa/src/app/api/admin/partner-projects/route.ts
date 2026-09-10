import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "fai in modo che veda i progetti partner che possa
// aprirli e inviare le email"): espone dal sito i "Progetti" reali
// (erpv6.tracking.relation, es. "Progetto TEE" con le parti collegate
// come Enzo/Manuel) - stesso modello gia' usato in Odoo, stesso wizard
// di invio email aggiunto oggi lato Odoo (erpv6.project.relay.send.email.wizard).
// Solo i nodi radice qui (parent_id=False) - i figli si vedono aprendo
// il dettaglio, stessa struttura di action_tracking_relation_projects in Odoo.
export async function GET() {
  try {
    await odoo.connect();

    const roots = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', false]], ['id', 'name', 'email_alias', 'partner_id', 'child_ids'], 0, 100, 'name asc',
    ]);

    return NextResponse.json({
      success: true,
      projects: (roots || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        emailAlias: r.email_alias ? `${r.email_alias}@v6sviluppoimpresa.it` : null,
        partnerCount: (r.child_ids || []).length,
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partner-projects:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

// 10/09/2026 (Denis: "inserisci il pulsante per creare un nuovo
// progetto"): crea un nuovo nodo radice erpv6.tracking.relation - stesso
// modello, nessun campo diverso da quelli reali gia' usati altrove
// (name required, email_alias opzionale, mai un partner_id sul nodo
// radice per costruzione del modello).
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { name, emailAlias } = body || {};
  if (!name) {
    return NextResponse.json({ success: false, error: 'Il nome è obbligatorio' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const projectId = await odoo.execute('erpv6.tracking.relation', 'create', [{
      name,
      email_alias: emailAlias || false,
    }]);
    return NextResponse.json({ success: true, projectId });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/partner-projects:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
