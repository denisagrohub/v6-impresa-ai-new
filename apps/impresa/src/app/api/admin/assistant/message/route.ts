import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "con il quale noi possiamo scrivere e analizzare
// il progetto") - riusa send_resource_chat_message gia' reale
// (erpv6_agent): carica lo storico, chiama l'AI col contesto specifico
// del progetto, salva la risposta - stesso schema di una conversazione
// Telegram con Susanna, qui via web.
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { resModel, resId, message, agentCode } = body || {};
  if (!resModel || !resId || !message) {
    return NextResponse.json({ success: false, error: 'resModel, resId e message sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const answer = await odoo.execute('erpv6.agent.config', 'send_resource_chat_message', [agentCode || 'susanna', resModel, Number(resId), message]);
    return NextResponse.json({ success: true, answer });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/assistant/message:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Invio fallito' }, { status: 502 });
  }
}
