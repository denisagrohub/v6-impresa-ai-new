import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET /api/admin/referrals?projectId=5 — lista referral di un progetto (o tutti)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');

  try {
    await odoo.connect();
    const domain: any[] = [];
    if (projectId) domain.push(['relation_id', '=', parseInt(projectId, 10)]);

    const refs = await odoo.execute('erpv6.referral', 'search_read', [
      domain,
      ['id', 'name', 'segnalante_partner_id', 'segnalante_user_id',
       'relation_id', 'target_id', 'contatto_segnalato_nome', 'contatto_segnalato_recapito',
       'commissione_pct', 'state', 'creato_il', 'blockchain_record_id'],
      0, 0, 'create_date desc',
    ]);

    return NextResponse.json({
      success: true,
      referrals: (refs || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        segnalanteName: Array.isArray(r.segnalante_partner_id) ? r.segnalante_partner_id[1]
                     : Array.isArray(r.segnalante_user_id) ? r.segnalante_user_id[1] : null,
        segnalanteId: Array.isArray(r.segnalante_partner_id) ? r.segnalante_partner_id[0] : null,
        relationId: Array.isArray(r.relation_id) ? r.relation_id[0] : null,
        relationName: Array.isArray(r.relation_id) ? r.relation_id[1] : null,
        targetId: Array.isArray(r.target_id) ? r.target_id[0] : null,
        targetName: Array.isArray(r.target_id) ? r.target_id[1] : null,
        contattoNome: r.contatto_segnalato_nome,
        contattoRecapito: r.contatto_segnalato_recapito,
        commissionePct: r.commissione_pct,
        state: r.state,
        creatoIl: r.creato_il,
        blockchainRecordId: Array.isArray(r.blockchain_record_id) ? r.blockchain_record_id[0] : null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

// POST /api/admin/referrals
// body: { relationId, segnalantePartnerId?, segnalanteUserId?, contattoNome, contattoRecapito, commissionePct, note }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.relationId) return NextResponse.json({ success: false, error: 'relationId obbligatorio' }, { status: 400 });
    if (!body.segnalantePartnerId && !body.segnalanteUserId) {
      return NextResponse.json({ success: false, error: 'Serve un segnalante' }, { status: 400 });
    }
    if (!body.contattoNome?.trim()) return NextResponse.json({ success: false, error: 'Nome contatto obbligatorio' }, { status: 400 });

    await odoo.connect();
    const vals: any = {
      relation_id: body.relationId,
      contatto_segnalato_nome: body.contattoNome.trim(),
      contatto_segnalato_recapito: body.contattoRecapito?.trim() || false,
      note_segnalazione: body.note?.trim() || false,
      commissione_pct: Number(body.commissionePct) || 5.0,
      state: 'bozza',
    };
    if (body.segnalantePartnerId) vals.segnalante_partner_id = body.segnalantePartnerId;
    if (body.segnalanteUserId) vals.segnalante_user_id = body.segnalanteUserId;

    const id = await odoo.execute('erpv6.referral', 'create', [vals]);
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
