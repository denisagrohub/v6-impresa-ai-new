import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 14/09/2026: conta email NON viste (create_date > x_v6_emails_seen_at
// della radice, o tutte se mai aperte) per OGNI progetto — una chiamata
// per lista progetti e dashboard, badge numerico sul pulsante/card.
export async function GET() {
  try {
    await odoo.connect();
    const roots = await odoo.execute('erpv6.tracking.relation', 'search_read', [
      [['parent_id', '=', false]], ['id', 'x_v6_emails_seen_at'], 0, 500,
    ]);
    const summary: Record<number, number> = {};
    for (const r of roots || []) {
      const dom: any[] = [['relation_id', 'in', [r.id]]];
      if (r.x_v6_emails_seen_at) dom.push([['create_date', '>', r.x_v6_emails_seen_at]]);
      summary[r.id] = await odoo.execute('erpv6.project.email.log', 'search_count', [dom]);
    }
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}
