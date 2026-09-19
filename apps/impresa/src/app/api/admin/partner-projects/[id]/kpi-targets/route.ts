import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET/PATCH — target di rendimento (separati dal charter, non versionati)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const [p] = await odoo.execute('erpv6.tracking.relation', 'read', [[id], ['x_v6_kpi_targets']]);
    let targets: any = {};
    try { targets = p?.x_v6_kpi_targets ? JSON.parse(p.x_v6_kpi_targets) : {}; } catch {}
    return NextResponse.json({ success: true, targets });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    const body = await req.json();
    const targets = {
      targetAttivi: Number(body.targetAttivi) || 20,
      partnerAnno: Number(body.partnerAnno) || 5,
      callMese: Number(body.callMese) || 10,
      emailMese: Number(body.emailMese) || 30,
    };
    await odoo.connect();
    await odoo.execute('erpv6.tracking.relation', 'write', [[id], {
      x_v6_kpi_targets: JSON.stringify(targets),
    }]);
    return NextResponse.json({ success: true, targets });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
