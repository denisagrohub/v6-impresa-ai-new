import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 23/09/2026: lista completa candidature con filtro per stato e per
// progetto di origine (pitch pubblico).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');       // 'nuova' | 'in_valutazione' | 'archiviata'
  const projectAlias = searchParams.get('project'); // es. 'progetto-tee'

  try {
    await odoo.connect();
    const domain: any[] = [];
    if (state) domain.push(['state', '=', state]);
    if (projectAlias) domain.push(['source_project_alias', '=', projectAlias]);

    // Prova prima con i campi nuovi; fallback se non presenti
    let fields = ['id', 'name', 'company_name', 'email', 'phone', 'proposal', 'state', 'create_date', 'source_project_alias', 'source_project_id'];
    let rows: any[] = [];
    try {
      rows = await odoo.execute('erpv6.partnership.candidacy', 'search_read', [
        domain, fields, 0, 200, 'create_date desc',
      ]);
    } catch {
      // moduli vecchi: senza source_project
      fields = ['id', 'name', 'company_name', 'email', 'phone', 'proposal', 'state', 'create_date'];
      rows = await odoo.execute('erpv6.partnership.candidacy', 'search_read', [
        domain, fields, 0, 200, 'create_date desc',
      ]);
    }

    return NextResponse.json({
      success: true,
      candidacies: (rows || []).map((c) => ({
        id: c.id,
        name: c.name,
        companyName: c.company_name,
        email: c.email,
        phone: c.phone,
        proposal: c.proposal,
        state: c.state,
        createDate: c.create_date,
        sourceProjectAlias: c.source_project_alias || null,
        sourceProjectId: c.source_project_id ? (Array.isArray(c.source_project_id) ? c.source_project_id[0] : c.source_project_id) : null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}
