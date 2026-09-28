import { NextRequest, NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 28/09/2026: crea figlio progetto + deal + variabili + checklist
// Body: {seller_partner_id, buyer_partner_id, nome?, revenue_model?, schema_code?,
//        volume_month?, prezzo_base?, fee_pct?, durata_mesi?, unit?}
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parentId = parseInt(params.id, 10);
  if (!parentId) {
    return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  }

  try {
    await odoo.connect();
    const body = await req.json();

    if (!body.seller_partner_id || !body.buyer_partner_id) {
      return NextResponse.json(
        { success: false, error: 'Venditore e compratore obbligatori' },
        { status: 400 }
      );
    }

    const params: any = {
      parent_id: parentId,
      seller_partner_id: parseInt(body.seller_partner_id, 10),
      buyer_partner_id: parseInt(body.buyer_partner_id, 10),
    };
    if (body.nome) params.nome = body.nome.trim();
    if (body.volume_month) params.volume_month = parseFloat(body.volume_month);
    if (body.prezzo_base) params.prezzo_base = parseFloat(body.prezzo_base);
    if (body.fee_pct) params.fee_pct = parseFloat(body.fee_pct);
    if (body.durata_mesi) params.durata_mesi = parseInt(body.durata_mesi, 10);
    if (body.revenue_model) params.revenue_model = body.revenue_model;
    if (body.schema_code) params.schema_code = body.schema_code;
    if (body.unit) params.unit = body.unit;

    const result = await odoo.execute(
      'erpv6.tracking.relation',
      'action_create_deal',
      [params]
    );

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error('create-deal error:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Errore' },
      { status: 500 }
    );
  }
}
