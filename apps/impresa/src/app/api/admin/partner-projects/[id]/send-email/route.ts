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

  const { partnerIds, extraEmails, subject, message, linkedEventId } = body || {};

  // 01/10/2026 (debug temp): log del payload ricevuto
  console.log('📧 send-email payload:', JSON.stringify({
    partnerIds, extraEmails, linkedEventId,
    subject: subject?.slice(0, 50),
    message_len: message?.length,
  }));
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

    // 01/10/2026 (B): se l'email è collegata a un evento (es. tavolo),
    // crea un evento figlio nella timeline.
    let linkedEventCreatedId: number | null = null;
    if (linkedEventId) {
      try {
        const parentEv = await odoo.execute('erpv6.deal.event', 'read', [
          [linkedEventId], ['id', 'relation_id', 'deal_id', 'title'],
        ]);
        if (parentEv && parentEv.length) {
          const parent = parentEv[0];
          const evVals: any = {
            parent_event_id: linkedEventId,
            event_type: 'email_rilevante',
            title: subject,
            description: `<p>Email inviata a ${partnerIds?.length || 0} parti${extraEmails ? ' + extra' : ''}</p><p>${(message || '').slice(0, 500)}</p>`,
            visibility: 'internal',
          };
          const relId = Array.isArray(parent.relation_id) ? parent.relation_id[0] : parent.relation_id;
          const dealId = Array.isArray(parent.deal_id) ? parent.deal_id[0] : parent.deal_id;
          if (relId) evVals.relation_id = relId;
          if (dealId) evVals.deal_id = dealId;

          linkedEventCreatedId = await odoo.execute('erpv6.deal.event', 'create', [evVals]);
        }
      } catch (e: any) {
        console.error('linkedEvent create KO:', e.message);
      }
    }

    return NextResponse.json({ success: true, linkedEventId: linkedEventCreatedId });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partner-projects/[id]/send-email:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Invio fallito' }, { status: 502 });
  }
}
