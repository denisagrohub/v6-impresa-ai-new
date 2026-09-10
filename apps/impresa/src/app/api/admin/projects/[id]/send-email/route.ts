import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "dopo un brief/debrief... la possibilità di
// inviare la email ai partecipanti"): per i Progetti (erpv6.production.order,
// es. Win-Win) il "partecipante" è il contatto del lead - stesso mittente
// di sistema (mail.default.from, Brevo) e stesso pattern gia' reale di
// report_token.py._send_ready_email, MAI il server register.it usato
// per i Progetti Partner (business/identita' di invio diversa).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { subject, message } = body || {};
  if (!subject || !message) {
    return NextResponse.json({ success: false, error: 'Oggetto e testo sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();

    const orders = await odoo.execute('erpv6.production.order', 'search_read', [
      [['id', '=', id]], ['lead_id'],
    ]);
    if (!orders || !orders.length) {
      return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    }
    const leadId = Array.isArray(orders[0].lead_id) ? orders[0].lead_id[0] : null;
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Nessun lead collegato a questo progetto' }, { status: 400 });
    }
    const leads = await odoo.execute('crm.lead', 'search_read', [[['id', '=', leadId]], ['email_from']]);
    const emailTo = leads && leads[0] && leads[0].email_from;
    if (!emailTo) {
      return NextResponse.json({ success: false, error: 'Nessuna email sul contatto di questo progetto' }, { status: 400 });
    }

    const defaultFromParams = await odoo.execute('ir.config_parameter', 'search_read', [
      [['key', '=', 'mail.default.from']], ['value'], 0, 1,
    ]);
    const defaultFrom = (defaultFromParams && defaultFromParams[0] && defaultFromParams[0].value) || 'noreply@v6impresa.it';
    const emailFrom = defaultFrom.includes('@') ? defaultFrom : 'noreply@v6impresa.it';

    const mailId = await odoo.execute('mail.mail', 'create', [{
      email_from: emailFrom,
      email_to: emailTo,
      subject,
      body_html: `<p>${String(message).replace(/\n/g, '<br/>')}</p>`,
      auto_delete: false,
    }]);
    await odoo.execute('mail.mail', 'send', [[mailId]]);

    return NextResponse.json({ success: true, sentTo: emailTo });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/projects/[id]/send-email:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Invio fallito' }, { status: 502 });
  }
}
