import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 17/09/2026 (Denis): separati "partners" (controparti reali, tab Persone/Parti)
// da "subprojects" (rami operativi con pipeline propria, es. Acquisizione Aziende).
// Aggiunti al PATCH i campi settings: child_kind default, owner, access.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const projects = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['id', '=', id]],
      ['id', 'name', 'email_alias', 'partner_id', 'x_v6_charter', 'x_v6_emails_seen_at', 'parent_id', 'x_v6_scouting', 'funzione_progetto', 'contatto_principale_id', 'state'],
    ]);
    if (!projects || !projects.length) {
      return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });
    }
    const project = projects[0];

    // Mark-seen
    try {
      await odoo.execute('erpv6.tracking.relation', 'write', [[id], {
        x_v6_emails_seen_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }]);
    } catch (e: any) {
      console.error('⚠️ mark-seen fallito:', e.message);
    }

    const children = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', id]],
      ['id', 'name', 'ruolo', 'partner_id', 'funzione_progetto', 'email_alias', 'contatto_principale_id', 'ruolo_contatto', 'state', 'stage_id'],
      0, 0, 'name asc',
    ]);

    const allChildren = children || [];
    // Nuovo modello: parti = figli NON target (committente, consulente, ecc.)
    // target = figli funzione_progetto='target' (vanno nel kanban, non in Persone/Parti)
    const parts = allChildren.filter((c: any) => c.funzione_progetto !== 'target');
    const targets = allChildren.filter((c: any) => c.funzione_progetto === 'target');

    const relationIds = [id, ...allChildren.map((c: any) => c.id)];
    const emails = await odoo.execute('erpv6.project.email.log', 'search_read', [
      [['relation_id', 'in', relationIds]],
      ['id', 'name', 'sender_email', 'recipient_emails', 'cc_emails', 'match_status', 'direction', 'create_date'],
      0, 100, 'create_date desc',
    ]);

    let charter = null;
    try { charter = project.x_v6_charter ? JSON.parse(project.x_v6_charter) : null; } catch { charter = null; }

    let relationScouting = null;
    try { relationScouting = project.x_v6_scouting ? JSON.parse(project.x_v6_scouting) : null; } catch { relationScouting = null; }

    // 18/09/2026 (Denis): verifica sincrona della pipeline per evitare il flash
    // "pagina standard -> kanban" sui sotto-progetti.
    // hasPipelineBoard = questo nodo ha figli con funzione_progetto='target'
    // (in tal caso è un "progetto root con pipeline" → dashboard kanban)
    const hasPipelineBoard = targets.length > 0;

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        emailAlias: project.email_alias ? `${project.email_alias}@v6sviluppoimpresa.it` : null,
        x_v6_emails_seen_at: project.x_v6_emails_seen_at || null,
        charter,
        relationScouting,
        funzione_progetto: project.funzione_progetto || null,
        contatto_principale_id: Array.isArray(project.contatto_principale_id) ? project.contatto_principale_id[0] : null,
        state: project.state || 'attivo',
        hasPipelineBoard,
        parent_id: Array.isArray(project.parent_id) ? project.parent_id[0] : null,
      },
      partners: parts.map((c: any) => ({
        id: c.id,
        name: c.name,
        ruolo: c.ruolo || null,
        funzione_progetto: c.funzione_progetto || null,
        partnerId: Array.isArray(c.partner_id) ? c.partner_id[0] : null,
        partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
        contattoId: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null,
        contattoName: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[1] : null,
        ruoloContatto: c.ruolo_contatto || null,
        state: c.state || 'attivo',
      })),
      targets: targets.map((c: any) => ({
        id: c.id,
        name: c.name,
        partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
        contattoName: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[1] : null,
        stageId: Array.isArray(c.stage_id) ? c.stage_id[0] : null,
        state: c.state || 'attivo',
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

// PATCH: aggiorna charter e/o settings (owner, access, child_kind default).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    const body = await request.json();
    const { charter, settings, scouting } = body as { charter?: any; settings?: any; scouting?: any };

    await odoo.connect();
    const writeVals: any = {};

    // --- charter (con versioning) ---
    if (charter && typeof charter === 'object') {
      const payload = {
        version: (charter as any).version || 1,
        updatedAt: new Date().toISOString(),
        history: (charter as any).history || [],
        data: (charter as any).data || charter,
      };
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
      writeVals.x_v6_charter = JSON.stringify(payload);
    }

    // --- settings (owner, access, kind) ---
    if (settings && typeof settings === 'object') {
      if ('owner_user_id' in settings) writeVals.owner_user_id = settings.owner_user_id || false;
      if ('access_user_ids' in settings && Array.isArray(settings.access_user_ids)) {
        writeVals.access_user_ids = [[6, 0, settings.access_user_ids]];
      }
      if ('child_kind' in settings && settings.child_kind) {
        writeVals.child_kind = settings.child_kind;
      }
    }

    // --- scouting relazione (18/09/2026) ---
    // JSON versionato: aggiunge/aggiorna x_v6_scouting con version bump e provenance
    if (scouting && typeof scouting === 'object') {
      const existingScouting = await odoo.execute('erpv6.tracking.relation', 'read', [[id], ['x_v6_scouting']]);
      let prev: any = null;
      try {
        const raw = existingScouting?.[0]?.x_v6_scouting;
        prev = raw ? JSON.parse(raw) : null;
      } catch { prev = null; }

      const payload = {
        schemaVersion: scouting.schemaVersion || prev?.schemaVersion || 1,
        version: (prev?.version || 0) + 1,
        savedAt: new Date().toISOString(),
        data: scouting.data || scouting,
        history: prev?.history || [],
      };
      if (prev?.data) {
        payload.history = [
          ...(prev.history || []),
          { version: prev.version, savedAt: prev.savedAt, data: prev.data },
        ];
      }
      writeVals.x_v6_scouting = JSON.stringify(payload);
    }

    if (Object.keys(writeVals).length === 0) {
      return NextResponse.json({ success: false, error: 'Nessun campo da aggiornare' }, { status: 400 });
    }

    await odoo.execute('erpv6.tracking.relation', 'write', [[id], writeVals]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore PATCH:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 503 });
  }
}
