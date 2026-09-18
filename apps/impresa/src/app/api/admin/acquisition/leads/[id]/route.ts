import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// PATCH /api/admin/acquisition/leads/[id]
// body: { stageId } | { destParentId } | { state }
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const targetId = parseInt(params.id, 10);
  if (!targetId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    const body = await request.json();
    await odoo.connect();

    if (body.stageId) {
      const [stage] = await odoo.execute('erpv6.acquisition.stage', 'read', [[body.stageId], ['relation_id', 'name']]);
      const stageRelId = Array.isArray(stage?.relation_id) ? stage.relation_id[0] : null;
      if (stageRelId !== targetId) {
        return NextResponse.json({ success: false, error: 'La fase non appartiene a questo target' }, { status: 400 });
      }
      await odoo.execute('erpv6.tracking.relation', 'write', [[targetId], { stage_id: body.stageId }]);
      return NextResponse.json({ success: true, stageId: body.stageId, stageName: stage.name });
    }

    if (body.destParentId) {
      await odoo.execute('erpv6.tracking.relation', 'write', [[targetId], { parent_id: body.destParentId }]);
      return NextResponse.json({ success: true });
    }

    if (body.state) {
      await odoo.execute('erpv6.tracking.relation', 'write', [[targetId], { state: body.state }]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Parametro mancante (stageId | destParentId | state)' }, { status: 400 });
  } catch (e: any) {
    console.error('patch target error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

// GET /api/admin/acquisition/leads/[id]
// Lista progetti root alternativi (per "sposta ad altro progetto").
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const targetId = parseInt(params.id, 10);
  if (!targetId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const [t] = await odoo.execute('erpv6.tracking.relation', 'read', [[targetId], ['parent_id']]);
    const currentParent = Array.isArray(t?.parent_id) ? t.parent_id[0] : null;

    const roots = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', false], ['id', '!=', currentParent]],
      ['id', 'name'],
      0, 0, 'name asc',
    ]);
    return NextResponse.json({ success: true, siblings: roots || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
