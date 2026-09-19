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

    // 19/09/2026: arricchisci con email partner E email contatto principale
    // (per filtro email contestuale: cerco sia info@azienda sia mario@azienda)
    const allPartnerIds = new Set<number>();
    for (const c of allChildren) {
      const pid = Array.isArray(c.partner_id) ? c.partner_id[0] : null;
      const cid = Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null;
      if (pid) allPartnerIds.add(pid);
      if (cid) allPartnerIds.add(cid);
    }
    const partnerIdArr = Array.from(allPartnerIds);
    if (partnerIdArr.length) {
      const partnerEmails = await odoo.execute('res.partner', 'search_read', [
        [['id', 'in', partnerIdArr]],
        ['id', 'email'],
      ]);
      const emailMap: Record<number, string> = {};
      for (const p of partnerEmails || []) emailMap[p.id] = p.email;
      for (const c of allChildren) {
        const pid = Array.isArray(c.partner_id) ? c.partner_id[0] : null;
        const cid = Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null;
        c._partner_email = pid ? emailMap[pid] : null;
        c._contatto_email = cid ? emailMap[cid] : null;
      }
    }
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
    // 19/09/2026: i target hanno contatto_principale_id (persona fisica).
    // Va esposto nella lista "partners" come persona, per poterlo chiamare/mailare.
    const targetContacts: any[] = [];
    for (const t of targets) {
      const cid = Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[0] : null;
      if (cid) {
        targetContacts.push({
          id: cid,
          name: Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[1] : '',
          ruolo: t.ruolo_contatto || null,
          funzione_progetto: 'referente_tecnico',
          partnerId: cid,
          partnerName: Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[1] : '',
          partnerEmail: null,
          contattoId: null,
          contattoName: null,
          ruoloContatto: t.ruolo_contatto || null,
          state: 'attivo',
          _fromTarget: t.id,
          _fromTargetId: t.id,
          _fromTargetName: t.name || (Array.isArray(t.partner_id) ? t.partner_id[1] : 'target'),
          _fromTargetPartnerName: Array.isArray(t.partner_id) ? t.partner_id[1] : null,
        });
      }
    }
    // risolvi email di questi contatti in un colpo
    if (targetContacts.length) {
      const contactIds = targetContacts.map((c) => c.id);
      const contactEmails = await odoo.execute('res.partner', 'search_read', [
        [['id', 'in', contactIds]],
        ['id', 'name', 'email', 'phone'],
      ]);
      const emailMap: Record<number, { name: string; email: string | null; phone: string | null }> = {};
      for (const p of contactEmails || []) {
        emailMap[p.id] = { name: p.name || '', email: p.email || null, phone: p.phone || null };
      }
      for (const c of targetContacts) {
        const info = emailMap[c.id];
        if (info) {
          c.partnerEmail = info.email;
          c.contattoEmail = info.email;
          c.partnerPhone = info.phone;
          // Fix: sostituisci il display_name composto col name puro
          c.partnerName = info.name || c.partnerName;
          c.name = info.name || c.name;
        }
      }
    }

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
      partners: [...parts, ...targetContacts].map((c: any) => ({
        id: c.id,
        name: c.name,
        ruolo: c.ruolo || null,
        funzione_progetto: c.funzione_progetto || null,
        partnerId: Array.isArray(c.partner_id) ? c.partner_id[0] : null,
        partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
        partnerEmail: c._partner_email || null,
        contattoEmail: c._contatto_email || null,
        contattoId: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null,
        contattoName: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[1] : null,
        ruoloContatto: c.ruolo_contatto || null,
        state: c.state || 'attivo',
        fromTargetId: c._fromTargetId || null,
        fromTargetName: c._fromTargetName || null,
        fromTargetPartnerName: c._fromTargetPartnerName || null,
      })),
      targets: targets.map((c: any) => ({
        id: c.id,
        name: c.name,
        partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
        partnerEmail: c._partner_email || null,
        contattoName: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[1] : null,
        contattoEmail: c._contatto_email || null,
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
      // 19/09/2026: kpiTargets arriva come campo separato, va incorporato nel data
      const charterData = { ...((charter as any).data || {}) };
      if ((charter as any).kpiTargets) {
        charterData.kpiTargets = (charter as any).kpiTargets;
      }
      const payload = {
        version: (charter as any).version || 1,
        updatedAt: new Date().toISOString(),
        history: (charter as any).history || [],
        data: charterData,
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
