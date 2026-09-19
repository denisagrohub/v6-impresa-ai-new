import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET: legge partner + scouting
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pid = parseInt((await params).id, 10);
  if (!pid) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  await odoo.connect();
  const recs = await odoo.execute('res.partner', 'search_read', [
    [['id', '=', pid]],
    ['name', 'is_company', 'parent_id', 'function', 'email', 'phone', 'mobile', 'x_v6_scouting'],
    0, 1,
  ]);
  if (!recs?.length) return NextResponse.json({ success: false, error: 'Contatto non trovato' }, { status: 404 });
  let scouting = null;
  try { scouting = recs[0].x_v6_scouting ? JSON.parse(recs[0].x_v6_scouting) : null; } catch { /* non-JSON: ignora */ }
  return NextResponse.json({
    success: true,
    partner: { ...recs[0], parent_id: Array.isArray(recs[0].parent_id) ? recs[0].parent_id[0] : null },
    scouting,
  });
}

// PATCH: aggiorna scouting + campi anagrafici (email, phone, mobile, function, name)
// Regola: TUTTO vive su Odoo (res.partner). Niente stato locale persistente.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const pid = parseInt((await params).id, 10);
  if (!pid) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Payload non valido' }, { status: 400 });
  }

  await odoo.connect();

  const writeVals: any = {};

  // Campi anagrafici
  if ('email' in body) writeVals.email = body.email || false;
  if ('phone' in body) writeVals.phone = body.phone || false;
  if ('mobile' in body) writeVals.mobile = body.mobile || false;
  if ('function' in body) writeVals.function = body.function || false;
  if ('name' in body && body.name) writeVals.name = body.name;

  // Scouting versionato (struttura esistente)
  if (body.scouting && typeof body.scouting === 'object') {
    writeVals.x_v6_scouting = JSON.stringify(body.scouting);
  }

  if (Object.keys(writeVals).length === 0) {
    return NextResponse.json({ success: false, error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  await odoo.execute('res.partner', 'write', [[pid], writeVals]);

  return NextResponse.json({
    success: true,
    updated: Object.keys(writeVals),
    version: body.scouting?.version || null,
  });
}
