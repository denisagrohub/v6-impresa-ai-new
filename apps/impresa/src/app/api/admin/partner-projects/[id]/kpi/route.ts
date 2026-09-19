import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET /api/admin/partner-projects/[id]/kpi
// Calcola 6 KPI del progetto root (target, partner, pipeline, email, call, rendimento)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();

    // ── 1. Progetto + charter (per target configurabili)
    const [proj] = await odoo.execute('erpv6.tracking.relation', 'read', [
      [id],
      ['id', 'name', 'x_v6_charter'],
    ]);
    if (!proj) return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });

    let kpiTargets: any = {};
    try {
      const ch = proj.x_v6_charter ? JSON.parse(proj.x_v6_charter) : null;
      kpiTargets = ch?.data?.kpiTargets || ch?.kpiTargets || {};
    } catch {}

    // ── 2. Tutti i figli del root
    const children = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', id]],
      ['id', 'name', 'funzione_progetto', 'state', 'stage_id', 'create_date'],
      0, 0, 'create_date desc',
    ]);
    const allChildren = children || [];

    const targetsAll = allChildren.filter((c: any) => c.funzione_progetto === 'target');
    const targetsActive = targetsAll.filter((c: any) => c.state !== 'archiviato' && c.state !== 'bocciato');

    // Partner = target promossi o stage is_won
    const stageIds = targetsAll
      .map((c: any) => Array.isArray(c.stage_id) ? c.stage_id[0] : null)
      .filter((x: any) => x != null);
    let wonStageIds = new Set<number>();
    let stageInfo: Record<number, { name: string; is_won: boolean; is_lost: boolean; sequence: number }> = {};
    if (stageIds.length) {
      const stages = await odoo.execute('erpv6.acquisition.stage', 'search_read', [
        [['id', 'in', stageIds]],
        ['id', 'name', 'is_won', 'is_lost', 'sequence'],
      ]);
      for (const s of stages || []) {
        stageInfo[s.id] = { name: s.name, is_won: s.is_won, is_lost: s.is_lost, sequence: s.sequence };
        if (s.is_won) wonStageIds.add(s.id);
      }
    }
    const partnersAll = targetsAll.filter((c: any) => {
      const sid = Array.isArray(c.stage_id) ? c.stage_id[0] : null;
      return c.state === 'promosso' || (sid && wonStageIds.has(sid));
    });

    // ── 3. Media 3 mesi target creati (per trend)
    const now = new Date();
    const monthBounds: { start: Date; end: Date }[] = [];
    for (let i = 0; i < 3; i++) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBounds.push({ start, end });
    }
    const createdByMonth = monthBounds.map(({ start, end }) => {
      return targetsAll.filter((c: any) => {
        const d = new Date(c.create_date);
        return d >= start && d <= end;
      }).length;
    });
    const currentMonthCreated = createdByMonth[0];
    const prevMonths = createdByMonth.slice(1).filter((x) => x > 0);
    const media3m = prevMonths.length ? prevMonths.reduce((a, b) => a + b, 0) / prevMonths.length : 0;
    const trendPct = media3m > 0 ? Math.round(((currentMonthCreated - media3m) / media3m) * 100) : null;

    // ── 4. Pipeline breakdown (target per stage, ordinate)
    const pipelineBreakdown: { stage: string; count: number; is_won: boolean; is_lost: boolean }[] = [];
    const byStage: Record<string, { count: number; is_won: boolean; is_lost: boolean; sequence: number }> = {};
    for (const t of targetsActive) {
      const sid = Array.isArray(t.stage_id) ? t.stage_id[0] : null;
      if (!sid || !stageInfo[sid]) continue;
      const s = stageInfo[sid];
      if (!byStage[s.name]) byStage[s.name] = { count: 0, is_won: s.is_won, is_lost: s.is_lost, sequence: s.sequence };
      byStage[s.name].count++;
    }
    for (const [name, v] of Object.entries(byStage)) {
      pipelineBreakdown.push({ stage: name, count: v.count, is_won: v.is_won, is_lost: v.is_lost });
    }
    pipelineBreakdown.sort((a, b) => (byStage[a.stage].sequence - byStage[b.stage].sequence));

    // ── 5. Email / Call ultimi 30gg (root + tutti i figli)
    const relationIds = [id, ...allChildren.map((c: any) => c.id)];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = thirtyDaysAgo.toISOString().replace('T', ' ').slice(0, 19);

    const emails30 = await odoo.execute('erpv6.project.email.log', 'search_count', [
      [['relation_id', 'in', relationIds], ['create_date', '>=', dateStr]],
    ]);

    // Trend email ultimi 30gg: prendo i create_date e raggruppo per settimana
    const emailsList = await odoo.execute('erpv6.project.email.log', 'search_read', [
      [['relation_id', 'in', relationIds], ['create_date', '>=', dateStr]],
      ['create_date'],
      0, 0, 'create_date asc',
    ]);
    const emailTrend = buildWeeklyTrend(emailsList || [], 30);

    // Call: totale + durata media
    const calls30 = await odoo.execute('erpv6.call.log', 'search_read', [
      [['relation_id', 'in', relationIds], ['started_at', '>=', dateStr]],
      ['duration_minutes', 'started_at'],
      0, 0, 'started_at asc',
    ]);
    const callsCount = (calls30 || []).length;
    const callsDur = (calls30 || []).filter((c: any) => c.duration_minutes > 0).map((c: any) => c.duration_minutes);
    const avgCallDuration = callsDur.length ? Math.round(callsDur.reduce((a: number, b: number) => a + b, 0) / callsDur.length) : 0;
    const callTrend = buildWeeklyTrend((calls30 || []).map((c: any) => ({ create_date: c.started_at })), 30);

    // ── 6. Performance vs target (con semaforo)
    const sem = (actual: number, target: number) => {
      if (!target) return 'gray';
      const pct = actual / target;
      if (pct >= 0.8) return 'green';
      if (pct >= 0.5) return 'yellow';
      return 'red';
    };

    const targetsKpi = {
      targetAttivi: kpiTargets.targetAttivi || 20,
      partnerAnno: kpiTargets.partnerAnno || 5,
      callMese: kpiTargets.callMese || 10,
      emailMese: kpiTargets.emailMese || 30,
    };

    return NextResponse.json({
      success: true,
      kpi: {
        targets: {
          active: targetsActive.length,
          total: targetsAll.length,
          target: targetsKpi.targetAttivi,
          currentMonthCreated,
          media3m: Math.round(media3m * 10) / 10,
          trendPct,
          semaforo: sem(targetsActive.length, targetsKpi.targetAttivi),
        },
        partners: {
          count: partnersAll.length,
          target: targetsKpi.partnerAnno,
          semaforo: sem(partnersAll.length, targetsKpi.partnerAnno),
        },
        pipeline: {
          total: targetsActive.length,
          breakdown: pipelineBreakdown,
        },
        emails: {
          last30: emails30 || 0,
          target: targetsKpi.emailMese,
          daily: Math.round(((emails30 || 0) / 30) * 10) / 10,
          trend: emailTrend,
          semaforo: sem(emails30 || 0, targetsKpi.emailMese),
        },
        calls: {
          last30: callsCount,
          target: targetsKpi.callMese,
          avgDuration: avgCallDuration,
          trend: callTrend,
          semaforo: sem(callsCount, targetsKpi.callMese),
        },
        performance: {
          currentMonthCreated,
          media3m: Math.round(media3m * 10) / 10,
          delta: Math.round((currentMonthCreated - media3m) * 10) / 10,
          trendPct,
          semaforo: trendPct == null ? 'gray' : trendPct >= 0 ? 'green' : trendPct >= -20 ? 'yellow' : 'red',
        },
      },
    });
  } catch (e: any) {
    console.error('kpi error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

// Costruisce una serie settimanale da una lista di record con create_date
function buildWeeklyTrend(rows: any[], days: number): number[] {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.ceil(days / 7);
  const buckets = new Array(weeks).fill(0);
  for (const r of rows) {
    const d = new Date(r.create_date).getTime();
    const diff = now - d;
    const idx = weeks - 1 - Math.floor(diff / weekMs);
    if (idx >= 0 && idx < weeks) buckets[idx]++;
  }
  return buckets;
}
