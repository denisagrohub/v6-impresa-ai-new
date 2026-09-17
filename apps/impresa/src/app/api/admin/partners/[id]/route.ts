import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET: legge partner + scouting / PATCH: salva scouting versionato su x_v6_scouting
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pid = parseInt((await params).id, 10);
  if (!pid) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  await odoo.connect();
  const recs = await odoo.execute('res.partner', 'search_read', [
    [['id', '=', pid]],
    ['name', 'is_company', 'parent_id', 'function', 'email', 'phone', 'x_v6_scouting'],
    0, 1,
  ]);
  if (!recs?.length) return NextResponse.json({ success: false, error: 'Contatto non trovato' }, { status: 404 });
  let scouting = null;
  try { scouting = recs[0].x_v6_scouting ? JSON.parse(recs[0].x_v6_scouting) : null; } catch { /* non-JSON: ignora */ }
  return NextResponse.json({ success: true, partner: { ...recs[0], parent_id: Array.isArray(recs[0].parent_id) ? recs[0].parent_id[0] : null }, scouting });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const pid = parseInt((await params).id, 10);
  const body = await req.json().catch(() => null);
  if (!pid || !body?.scouting) return NextResponse.json({ success: false, error: 'Payload non valido' }, { status: 400 });
  await odoo.connect();
  await odoo.execute('res.partner', 'write', [[pid], { x_v6_scouting: JSON.stringify(body.scouting) }]);
  return NextResponse.json({ success: true, version: body.scouting.version });
}
