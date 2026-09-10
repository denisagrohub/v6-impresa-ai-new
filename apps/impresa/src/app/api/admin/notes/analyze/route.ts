import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "dare in pasto a metodology tutta la lavagna e
// avere un responso") - riusa erpv6.project.note.analyze_board() gia'
// reale (erpv6_methodology): legge tutte le note, chiede un'analisi
// attraverso Kairós/Pareto/5S, e la appende come nuovo post-it.
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { resModel, resId } = body || {};
  if (!resModel || !resId) {
    return NextResponse.json({ success: false, error: 'resModel e resId sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const notes = await odoo.execute('erpv6.project.note', 'analyze_board', [resModel, Number(resId)]);
    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/notes/analyze:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Analisi fallita' }, { status: 502 });
  }
}
