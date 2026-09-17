import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const projects = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['id', '=', id]], ['id', 'name', 'email_alias', 'partner_id', 'x_v6_charter', 'x_v6_emails_seen_at'],
    ]);
    if (!projects || !projects.length) {
      return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    }
    const project = projects[0];
    // Mark-seen: aggiorniamo il timestamp di ultima lettura (Denis, 14/09/2026)
    try {
      await odoo.execute('erpv6.tracking.relation', 'write', [[id], {
        x_v6_emails_seen_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }]);
    } catch (e: any) {
      console.error('⚠️ mark-seen fallito:', e.message);
    }

    const children = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', id]], ['id', 'name', 'ruolo', 'partner_id'], 0, 0, 'name asc',
    ]);

    const relationIds = [id, ...(children || []).map((c: any) => c.id)];
    const emails = await odoo.execute('erpv6.project.email.log', 'search_read', [
      [['relation_id', 'in', relationIds]],
      ['id', 'name', 'sender_email', 'recipient_emails', 'cc_emails', 'match_status', 'direction', 'create_date'],
      0, 100, 'create_date desc',
    ]);

    let charter = null;
    try { charter = project.x_v6_charter ? JSON.parse(project.x_v6_charter) : null; } catch { charter = null; }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        emailAlias: project.email_alias ? `${project.email_alias}@v6sviluppoimpresa.it` : null,
        x_v6_emails_seen_at: project.x_v6_emails_seen_at || null,
        charter,
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    const { charter } = await request.json();
    if (!charter || typeof charter !== 'object') {
      return NextResponse.json({ success: false, error: 'Charter non valido' }, { status: 400 });
    }

    // Versioning: il charter salvato contiene version, updatedAt, history, data
    const payload = {
      version: (charter as any).version || 1,
      updatedAt: new Date().toISOString(),
      history: (charter as any).history || [],
      data: (charter as any).data || charter,
    };
    // Se l'utente sta aggiornando una scheda esistente, archivia la versione corrente
    const existing = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['id', '=', id]], ['x_v6_charter'],
    ]);
    if (existing && existing[0]?.x_v6_charter) {
      try {
        const prev = JSON.parse(existing[0].x_v6_charter);
        if (prev?.version) {
          payload.version = prev.version + 1;
          payload.history = [
            ...(prev.history || []),
            { version: prev.version, updatedAt: prev.updatedAt, data: prev.data },
          ];
        }
      } catch { /* charter precedente corrotto: ripartiamo da v1 */ }
    }

    await odoo.connect();
    await odoo.execute('erpv6.tracking.relation', 'write', [[id], {
      x_v6_charter: JSON.stringify(payload),
    }]);
    return NextResponse.json({ success: true, version: payload.version });
  } catch (error: any) {
    console.error('❌ Errore PATCH charter:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 503 });
  }
}
