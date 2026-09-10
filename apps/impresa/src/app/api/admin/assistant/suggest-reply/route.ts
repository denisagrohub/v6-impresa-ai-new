import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "manca la parte di susanna nell'analisi delle
// email di ogni progetto partner") - riusa draft_email_reply gia' reale
// (erpv6_agent): legge il corpo vero dell'email dal chatter e propone
// un testo di risposta, mai inviato in automatico (l'admin lo rivede/
// modifica nel form di invio esistente).
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { resModel, resId, emailLogId, agentCode } = body || {};
  if (!resModel || !resId || !emailLogId) {
    return NextResponse.json({ success: false, error: 'resModel, resId e emailLogId sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const draft = await odoo.execute('erpv6.agent.config', 'draft_email_reply', [agentCode || 'susanna', resModel, Number(resId), Number(emailLogId)]);
    return NextResponse.json({ success: true, draft });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/assistant/suggest-reply:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Suggerimento fallito' }, { status: 502 });
  }
}
