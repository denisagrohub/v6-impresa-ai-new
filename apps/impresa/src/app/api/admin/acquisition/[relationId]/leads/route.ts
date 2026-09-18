import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/acquisition/[relationId]/leads
// body: { partnerId } oppure { name, email }
export async function POST(request: Request, { params }: { params: { relationId: string } }) {
  const relationId = parseInt(params.relationId, 10);
  if (!relationId) return NextResponse.json({ success: false, error: 'relationId non valido' }, { status: 400 });

  try {
    const { partnerId, name, email } = await request.json();
    await odoo.connect();

    const firstStages = await odoo.execute('erpv6.acquisition.stage', 'search_read', [
      [['relation_id', '=', relationId]],
      ['id', 'name'],
      0, 1, 'sequence asc, id asc',
    ]);
    const firstStage = firstStages?.[0];
    if (!firstStage) {
      return NextResponse.json({ success: false, error: 'Nessuna fase configurata per questo sotto-progetto' }, { status: 400 });
    }

    let pid = partnerId;
    let createdPartner = false;
    if (!pid) {
      if (!name?.trim()) return NextResponse.json({ success: false, error: 'Serve partnerId o name' }, { status: 400 });
      const partnerVals: any = { name: name.trim(), is_company: true };
      if (email?.trim()) partnerVals.email = email.trim();
      pid = await odoo.execute('res.partner', 'create', [partnerVals]);
      createdPartner = true;
    }

    const existing = await odoo.execute('erpv6.acquisition.lead', 'search_count', [
      [['relation_id', '=', relationId], ['partner_id', '=', pid]],
    ]);
    if (existing) {
      return NextResponse.json({ success: false, error: 'Azienda già in pipeline' }, { status: 409 });
    }

    const leadId = await odoo.execute('erpv6.acquisition.lead', 'create', [{
      relation_id: relationId,
      partner_id: pid,
      stage_id: firstStage.id,
    }]);

    return NextResponse.json({ success: true, leadId, partnerId: pid, createdPartner, stageId: firstStage.id });
  } catch (e: any) {
    console.error('create lead error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
