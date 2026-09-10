import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Corpo reale dell'email (10/09/2026): erpv6.project.email.log salva solo
// mittente/oggetto come campi propri - il corpo vero arriva nel chatter
// nativo (mail.message) via message_process(), stesso posto in cui lo
// legge anche la scheda Odoo. Letto qui al volo, non duplicato nel log.
export async function GET(request: Request, { params }: { params: { emailId: string } }) {
  const emailId = parseInt(params.emailId, 10);
  if (!emailId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const messages = await odoo.execute('mail.message', 'search_read', [
      [['model', '=', 'erpv6.project.email.log'], ['res_id', '=', emailId], ['message_type', '!=', 'notification']],
      ['id', 'body', 'subject', 'date', 'email_from'],
      0, 5, 'date asc',
    ]);

    const withBody = (messages || []).find((m: any) => m.body && m.body.trim());

    return NextResponse.json({
      success: true,
      body: withBody?.body || null,
      date: withBody?.date || null,
      emailFrom: withBody?.email_from || null,
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partner-projects/[id]/emails/[emailId]:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
