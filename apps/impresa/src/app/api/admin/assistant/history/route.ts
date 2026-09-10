import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "un assistente dentro i progetti che abbia il
// contesto specifico del progetto") - storico reale della chat con
// Susanna su QUESTO progetto (erpv6.agent.chat.log, chat_key dedicata),
// stesso motore gia' usato per le conversazioni Telegram.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resModel = searchParams.get('resModel');
  const resId = searchParams.get('resId');
  const agentCode = searchParams.get('agentCode') || 'susanna';
  if (!resModel || !resId) {
    return NextResponse.json({ success: false, error: 'resModel e resId sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const history = await odoo.execute('erpv6.agent.config', 'get_resource_chat_history', [agentCode, resModel, Number(resId)]);
    return NextResponse.json({ success: true, history: history || [] });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/assistant/history:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
