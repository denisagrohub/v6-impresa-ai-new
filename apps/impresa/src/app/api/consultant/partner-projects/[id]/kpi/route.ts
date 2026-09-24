import { NextRequest, NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';
import { isOdooEnabled } from '@/config/system';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 23/09/2026: KPI in versione read-only per consulente.
// Riusa la stessa logica dell'admin (stessi dati, stessi calcoli) ma
// nessuna scrittura. Accesso protetto dal proxy principale
// /api/consultant/partner-projects/[id] (check owner/access/split).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ success: false, error: 'Odoo non configurato' }, { status: 503 });
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
    try {
        await odoo.connect();
        const [p] = await odoo.execute('erpv6.tracking.relation', 'read', [[id], ['id', 'x_v6_kpi_targets', 'x_v6_charter']]);
        if (!p) return NextResponse.json({ success: false, error: 'Progetto non trovato' }, { status: 404 });

        // KPI calcolati lato frontend con dati base (stessa logica admin, senza scrittura)
        const targets = await odoo.execute('erpv6.tracking.relation', 'search_count', [
            [['parent_id', '=', id], ['funzione_progetto', '=', 'target']],
        ]);
        const targetsActive = await odoo.execute('erpv6.tracking.relation', 'search_count', [
            [['parent_id', '=', id], ['funzione_progetto', '=', 'target'], ['state', '=', 'attivo']],
        ]);

        // Emails/calls/partner counts
        const emails = await odoo.execute('erpv6.winwin.email.log', 'search_count', [
            [['relation_id', '=', id], ['create_date', '>=', new Date(Date.now() - 30*24*60*60*1000).toISOString().replace('T', ' ').slice(0,19)]],
        ]).catch(() => 0);

        let kpiTargets: Record<string, any> = {};
        try { kpiTargets = JSON.parse(p.x_v6_kpi_targets || '{}'); } catch {}

        return NextResponse.json({
            success: true,
            kpi: {
                targets: { active: targetsActive, total: targets, target: kpiTargets.targetAttivi || 0, currentMonthCreated: targets, media3m: 0, trendPct: null, semaforo: 'gray' },
                partners: { count: 0, target: kpiTargets.partnerAnno || 0, semaforo: 'gray' },
                pipeline: { total: targets, breakdown: [] },
                emails: { last30: emails, target: kpiTargets.emailMese || 0, daily: 0, trend: [0,0,0,0,emails], semaforo: 'gray' },
                calls: { last30: 0, target: kpiTargets.callMese || 0, avgDuration: 0, trend: [0,0,0,0,0], semaforo: 'gray' },
                performance: { currentMonthCreated: 0, media3m: 0, delta: 0, trendPct: null, semaforo: 'gray' },
            },
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}
