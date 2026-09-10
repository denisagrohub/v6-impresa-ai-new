import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "che possa... inviare le email"): riusa lo stesso
// wizard/nodo di invio gia' costruito oggi lato Odoo
// (erpv6.project.relay.send.email.wizard, action_send) - nessuna nuova
// logica di invio qui, solo il ponte JSON-RPC create+action_send.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10);
  if (!projectId) return NextResponse.json({ success: false, error: 'ID progetto non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }

  const { partnerIds, extraEmails, subject, message } = body || {};
  if (!subject || !message) {
    return NextResponse.json({ success: false, error: 'Oggetto e testo sono obbligatori' }, { status: 400 });
  }
  if ((!partnerIds || !partnerIds.length) && !extraEmails) {
    return NextResponse.json({ success: false, error: 'Seleziona almeno un destinatario' }, { status: 400 });
  }

  try {
    await odoo.connect();

    const wizardId = await odoo.execute('erpv6.project.relay.send.email.wizard', 'create', [{
      project_id: projectId,
      partner_ids: partnerIds && partnerIds.length ? [[6, 0, partnerIds]] : false,
      extra_emails: extraEmails || false,
      subject,
      body: message,
    }]);

    await odoo.execute('erpv6.project.relay.send.email.wizard', 'action_send', [[wizardId]]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partner-projects/[id]/send-email:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Invio fallito' }, { status: 502 });
  }
}
