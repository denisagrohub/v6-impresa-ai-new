import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET /api/admin/acquisition/[relationId]/board — kanban sotto-progetto
export async function GET(_req: Request, { params }: { params: { relationId: string } }) {
  const relationId = parseInt(params.relationId, 10);
  if (!relationId) return NextResponse.json({ success: false, error: 'relationId non valido' }, { status: 400 });

  try {
    await odoo.connect();

    const stages = await odoo.execute('erpv6.acquisition.stage', 'search_read', [
      [['relation_id', '=', relationId]],
      ['id', 'name', 'sequence', 'is_won', 'is_lost'],
      0, 0, 'sequence asc, id asc',
    ]);

    const leads = await odoo.execute('erpv6.acquisition.lead', 'search_read', [
      [['relation_id', '=', relationId], ['active', '=', true]],
      ['id', 'partner_id', 'stage_id', 'notes', 'next_followup', 'stage_changed_at', 'call_id'],
      0, 0, 'write_date desc',
    ]);

    const partnerIds: number[] = Array.from(new Set(
      (leads || []).map((l: any) => Array.isArray(l.partner_id) ? l.partner_id[0] : null).filter((x: any) => x != null)
    )) as number[];

    let partnerMap: Record<number, any> = {};
    if (partnerIds.length) {
      const partners = await odoo.execute('res.partner', 'search_read', [
        [['id', 'in', partnerIds]],
        ['id', 'name', 'email', 'phone', 'x_v6_scouting'],
      ]);
      partnerMap = Object.fromEntries((partners || []).map((p: any) => [p.id, p]));
    }

    return NextResponse.json({
      success: true,
      stages: stages || [],
      leads: (leads || []).map((l: any) => {
        const pid = Array.isArray(l.partner_id) ? l.partner_id[0] : null;
        const p = pid ? partnerMap[pid] : null;
        let scouting: any = null;
        try { scouting = p?.x_v6_scouting ? JSON.parse(p.x_v6_scouting) : null; } catch {}
        return {
          id: l.id,
          partnerId: pid,
          partnerName: p?.name || '?',
          partnerEmail: p?.email || null,
          partnerPhone: p?.phone || null,
          settore: scouting?.identita?.settore || null,
          stageId: Array.isArray(l.stage_id) ? l.stage_id[0] : null,
          notes: l.notes || null,
          nextFollowup: l.next_followup || null,
          stageChangedAt: l.stage_changed_at,
          callId: Array.isArray(l.call_id) ? l.call_id[0] : null,
        };
      }),
    });
  } catch (e: any) {
    console.error('board error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
