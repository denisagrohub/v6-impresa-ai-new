import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const projects = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['id', '=', id]], ['id', 'name', 'email_alias', 'partner_id'],
    ]);
    if (!projects || !projects.length) {
      return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    }
    const project = projects[0];

    const children = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', id]], ['id', 'name', 'ruolo', 'partner_id'], 0, 0, 'name asc',
    ]);

    const relationIds = [id, ...(children || []).map((c: any) => c.id)];
    const emails = await odoo.execute('erpv6.project.email.log', 'search_read', [
      [['relation_id', 'in', relationIds]],
      ['id', 'name', 'sender_email', 'recipient_emails', 'cc_emails', 'match_status', 'direction', 'create_date'],
      0, 100, 'create_date desc',
    ]);

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        emailAlias: project.email_alias ? `${project.email_alias}@v6sviluppoimpresa.it` : null,
      },
      partners: (children || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        ruolo: c.ruolo || null,
        partnerId: Array.isArray(c.partner_id) ? c.partner_id[0] : null,
        partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
      })),
      emails: (emails || []).map((e: any) => ({
        id: e.id,
        subject: e.name,
        senderEmail: e.sender_email || '',
        recipientEmails: e.recipient_emails || '',
        ccEmails: e.cc_emails || '',
        matchStatus: e.match_status,
        direction: e.direction || 'ricevuta',
        date: e.create_date,
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partner-projects/[id]:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
