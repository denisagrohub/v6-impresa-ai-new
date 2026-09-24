import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET/PATCH — split V6 del progetto (base + beneficiari + riserva)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const [p] = await odoo.execute('erpv6.tracking.relation', 'read', [
      [id], ['x_v6_revenue_split', 'revenue_split_approved', 'revenue_split_approved_at', 'revenue_split_hash', 'revenue_split_state'],
    ]);
    let split: any = null;
    try { split = p?.x_v6_revenue_split ? JSON.parse(p.x_v6_revenue_split) : null; } catch {}
    return NextResponse.json({
      success: true,
      split,
      approved: !!p.revenue_split_approved,
      approvedAt: p.revenue_split_approved_at,
      hash: p.revenue_split_hash,
      state: p.revenue_split_state || 'bozza',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    const body = await req.json();
    // validazione: la somma delle % beneficiari + riserva V6 = 100
    const beneficiari = Array.isArray(body.beneficiari) ? body.beneficiari : [];
    const riserva = Number(body.riserva_v6_pct) || 0;
    const somma = beneficiari.reduce((s: number, b: any) => s + (Number(b.pct) || 0), 0) + riserva;
    if (Math.abs(somma - 100) > 0.001) {
      return NextResponse.json({ success: false, error: `Somma % = ${somma.toFixed(3)}% (deve essere 100%)` }, { status: 400 });
    }

    await odoo.connect();

    // Blocco se già approvato
    // 24/09/2026: modifica ammessa anche su split approvato.
    // La write Odoo resetta accettazioni e stato -> nuova firma a tutti.
    // Vecchio accordo firmato resta in libreria come prova storica.
    // (Fase 2: versioning + firme incrementali.)

    const payload = {
      base: body.base || {},
      beneficiari,
      riserva_v6_pct: riserva,
      note: body.note || '',
    };
    await odoo.execute('erpv6.tracking.relation', 'write', [[id], {
      x_v6_revenue_split: JSON.stringify(payload),
    }]);
    return NextResponse.json({ success: true, split: payload });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
