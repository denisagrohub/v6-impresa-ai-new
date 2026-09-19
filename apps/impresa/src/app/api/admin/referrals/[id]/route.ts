import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// PATCH /api/admin/referrals/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    const body = await req.json();
    const vals: any = {};
    if ('state' in body) vals.state = body.state;
    if ('commissionePct' in body) vals.commissione_pct = Number(body.commissionePct);
    if ('targetId' in body) vals.target_id = body.targetId || false;
    if ('accordoDocumensoId' in body) vals.accordo_documenso_id = body.accordoDocumensoId;
    if ('accordoUrl' in body) vals.accordo_url = body.accordoUrl;
    if ('contattoNome' in body) vals.contatto_segnalato_nome = body.contattoNome;
    if ('contattoRecapito' in body) vals.contatto_segnalato_recapito = body.contattoRecapito;
    if ('note' in body) vals.note_segnalazione = body.note;

    if (Object.keys(vals).length === 0) {
      return NextResponse.json({ success: false, error: 'Nessun campo' }, { status: 400 });
    }

    await odoo.connect();
    await odoo.execute('erpv6.referral', 'write', [[id], vals]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
