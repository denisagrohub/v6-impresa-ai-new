import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 01/10/2026 (F3.A UI): esegue scouting AI-driven on-demand.
// Di norma parte da solo al create, ma serve un pulsante "Riscouta"
// per: charter aggiornato, debounce scaduto, o forzatura manuale.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const result = await odoo.execute(
      'erpv6.tracking.relation',
      'action_run_scouting_from_charter',
      [[id]],
    );
    // action_run_scouting_from_charter è chiamato in loop su recordset
    // il wrapper ritorna dict se singolo, altrimenti None → normalizzo
    const payload = Array.isArray(result) ? result[0] : result;
    return NextResponse.json({ success: true, result: payload });
  } catch (e: any) {
    console.error('scouting-run error:', e);
    return NextResponse.json({ success: false, error: e.message || 'Errore' }, { status: 500 });
  }
}
