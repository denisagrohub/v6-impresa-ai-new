import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

const MICRO_STAGES: [string, number, boolean, boolean][] = [
  ['Nuova', 10, false, false],
  ['Contattata', 20, false, false],
  ['In attesa risposta', 30, false, false],
  ['Ha risposto', 40, false, false],
  ['Interessata', 50, false, false],
  ['Non interessata', 60, false, true],
  ['Charter inviato', 70, false, false],
  ['Partner', 80, true, false],
];

// POST /api/admin/acquisition/[relationId]/leads
// Crea un nuovo nodo target figlio di relationId con la sua pipeline micro.
export async function POST(request: Request, { params }: { params: { relationId: string } }) {
  const relationId = parseInt(params.relationId, 10);
  if (!relationId) return NextResponse.json({ success: false, error: 'relationId non valido' }, { status: 400 });

  try {
    const { partnerId, name, email, contattoId } = await request.json();
    await odoo.connect();

    let pid = partnerId;
    let createdPartner = false;
    if (!pid) {
      if (!name?.trim()) return NextResponse.json({ success: false, error: 'Serve partnerId o name' }, { status: 400 });
      const pv: any = { name: name.trim(), is_company: true };
      if (email?.trim()) pv.email = email.trim();
      pid = await odoo.execute('res.partner', 'create', [pv]);
      createdPartner = true;
    }

    const existing = await odoo.execute('erpv6.tracking.relation', 'search_count', [
      [['parent_id', '=', relationId], ['partner_id', '=', pid], ['funzione_progetto', '=', 'target']],
    ]);
    if (existing) {
      return NextResponse.json({ success: false, error: 'Azienda già in pipeline di questo progetto' }, { status: 409 });
    }

    const [p] = await odoo.execute('res.partner', 'read', [[pid], ['name']]);
    const vals: any = {
      parent_id: relationId,
      partner_id: pid,
      funzione_progetto: 'target',
      name: p?.name || 'Target',
    };
    if (contattoId) vals.contatto_principale_id = contattoId;

    const targetId = await odoo.execute('erpv6.tracking.relation', 'create', [vals]);

    for (const [sname, seq, won, lost] of MICRO_STAGES) {
      await odoo.execute('erpv6.acquisition.stage', 'create', [{
        name: sname, sequence: seq,
        relation_id: targetId,
        is_won: won, is_lost: lost,
      }]);
    }

    const firstStages = await odoo.execute('erpv6.acquisition.stage', 'search_read', [
      [['relation_id', '=', targetId]],
      ['id'],
      0, 1, 'sequence asc, id asc',
    ]);
    if (firstStages?.[0]) {
      await odoo.execute('erpv6.tracking.relation', 'write', [[targetId], { stage_id: firstStages[0].id }]);
    }

    return NextResponse.json({ success: true, targetId, leadId: targetId, partnerId: pid, createdPartner });
  } catch (e: any) {
    console.error('create target error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
