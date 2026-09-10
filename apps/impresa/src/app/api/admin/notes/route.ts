import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "manca in tutti i progetti una lavagna di lavoro
// sia per appuntare i brief e debrief ma anche note e informazioni").
// Nuovo motore reale erpv6.project.note (erpv6_methodology),
// polimorfico su res_model/res_id come erpv6.heinrich.indicator - non
// un chatter riusato (quello logga anche i cambi automatici dei campi,
// rumore rispetto a "quello che una persona ha deciso di scrivere").
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resModel = searchParams.get('resModel');
  const resId = searchParams.get('resId');
  if (!resModel || !resId) {
    return NextResponse.json({ success: false, error: 'resModel e resId sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const notes = await odoo.execute('erpv6.project.note', 'get_board', [resModel, Number(resId)]);
    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { resModel, resId, noteType, title, body: content } = body || {};
  if (!resModel || !resId || !content) {
    return NextResponse.json({ success: false, error: 'resModel, resId e contenuto sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    await odoo.execute('erpv6.project.note', 'create', [{
      res_model: resModel,
      res_id: Number(resId),
      note_type: noteType || 'nota',
      title: title || false,
      body: content,
    }]);
    const notes = await odoo.execute('erpv6.project.note', 'get_board', [resModel, Number(resId)]);
    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/notes:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
