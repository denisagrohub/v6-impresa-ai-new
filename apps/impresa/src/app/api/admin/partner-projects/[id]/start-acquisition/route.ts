import { NextRequest, NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 17/09/2026 (Denis): generalizzato. Accetta kind e pipelineTemplate dal body.
// Retrocompatibile: se non passati, default 'sotto_progetto' + 'acquisition'.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ success: false, error: 'Nome obbligatorio' }, { status: 400 });
    const emailAlias = (body.emailAlias || '').trim() || null;
    const kind = (body.kind || 'sotto_progetto').trim();
    const pipelineTemplate = (body.pipelineTemplate || 'acquisition').trim();

    const result = await odoo.execute(
      'erpv6.tracking.relation',
      'action_create_subproject',
      [id, name, kind, emailAlias, pipelineTemplate]
    );

    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    console.error('start-acquisition error:', e);
    return NextResponse.json({ success: false, error: e.message || 'Errore' }, { status: 500 });
  }
}
