import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET /api/admin/acquisition/[relationId]/board — kanban target figli di un root
// Modello: progetto root + figli target (funzione_progetto='target'),
// ognuno con la propria pipeline micro (8 fasi template).
export async function GET(_req: Request, { params }: { params: { relationId: string } }) {
  const relationId = parseInt(params.relationId, 10);
  if (!relationId) return NextResponse.json({ success: false, error: 'relationId non valido' }, { status: 400 });

  try {
    await odoo.connect();

    // 1) Target figli di relationId
    const targets = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', relationId], ['funzione_progetto', '=', 'target']],
      ['id', 'name', 'partner_id', 'contatto_principale_id', 'ruolo_contatto', 'stage_id', 'state'],
      0, 0, 'name asc',
    ]);

    if (!targets || targets.length === 0) {
      return NextResponse.json({ success: true, stages: [], leads: [] });
    }

    const targetIds = targets.map((t: any) => t.id);

    // 2) Stage di tutti i target (per costruire template colonne + mapping)
    const allStages = await odoo.execute('erpv6.acquisition.stage', 'search_read', [
      [['relation_id', 'in', targetIds]],
      ['id', 'name', 'sequence', 'is_won', 'is_lost', 'relation_id'],
      0, 0, 'sequence asc, id asc',
    ]);

    const columnMap = new Map<string, any>();
    const stageIdToName: Record<number, string> = {};
    const stagesByTarget: Record<number, Record<string, number>> = {};

    for (const s of allStages || []) {
      const key = s.name;
      if (!columnMap.has(key)) {
        columnMap.set(key, { name: s.name, sequence: s.sequence, is_won: s.is_won, is_lost: s.is_lost });
      }
      const relId = Array.isArray(s.relation_id) ? s.relation_id[0] : null;
      if (relId) {
        if (!stagesByTarget[relId]) stagesByTarget[relId] = {};
        stagesByTarget[relId][s.name] = s.id;
      }
      stageIdToName[s.id] = s.name;
    }
    const columns = Array.from(columnMap.values()).sort((a, b) => a.sequence - b.sequence);

    // 3) Partner + contatti
    const partnerIds = new Set<number>();
    for (const t of targets) {
      const pid = Array.isArray(t.partner_id) ? t.partner_id[0] : null;
      const cid = Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[0] : null;
      if (pid) partnerIds.add(pid);
      if (cid) partnerIds.add(cid);
    }
    const partnerMap: Record<number, any> = {};
    if (partnerIds.size) {
      const partners = await odoo.execute('res.partner', 'search_read', [
        [['id', 'in', Array.from(partnerIds)]],
        ['id', 'name', 'email', 'phone', 'x_v6_scouting'],
      ]);
      for (const p of partners || []) partnerMap[p.id] = p;
    }

    const leads = targets.map((t: any) => {
      const pid = Array.isArray(t.partner_id) ? t.partner_id[0] : null;
      const cid = Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[0] : null;
      const stageId = Array.isArray(t.stage_id) ? t.stage_id[0] : null;
      const p = pid ? partnerMap[pid] : null;
      const c = cid ? partnerMap[cid] : null;
      let scouting: any = null;
      try { scouting = p?.x_v6_scouting ? JSON.parse(p.x_v6_scouting) : null; } catch {}
      return {
        id: t.id,
        name: t.name,
        partnerId: pid,
        partnerName: p?.name || '?',
        partnerEmail: p?.email || null,
        partnerPhone: p?.phone || null,
        contattoId: cid,
        contattoName: c?.name || null,
        contattoRole: t.ruolo_contatto || null,
        settore: scouting?.identita?.settore || null,
        stageId,
        stageName: stageId ? stageIdToName[stageId] : null,
        stagesByName: stagesByTarget[t.id] || {},
        state: t.state,
        notes: null,
        nextFollowup: null,
        callId: null,
      };
    });

    return NextResponse.json({ success: true, stages: columns, leads });
  } catch (e: any) {
    console.error('board error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
