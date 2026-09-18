import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/calls/[id]/generate-lead
// body: { relationId (sotto-progetto destinazione), outcomeNoteId? }
// Crea un erpv6.acquisition.lead collegato alla call e al partner.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const callId = parseInt(params.id, 10);
  if (!callId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    const { relationId, outcomeNoteId } = await request.json();
    if (!relationId) return NextResponse.json({ success: false, error: 'relationId obbligatorio' }, { status: 400 });

    await odoo.connect();

    // 1) leggi call → partner
    const [call] = await odoo.execute('erpv6.call.log', 'read', [[callId], ['partner_id']]);
    if (!call) return NextResponse.json({ success: false, error: 'Call non trovata' }, { status: 404 });
    const partnerId = Array.isArray(call.partner_id) ? call.partner_id[0] : null;
    if (!partnerId) return NextResponse.json({ success: false, error: 'Call senza partner' }, { status: 400 });

    // 2) prima fase del sotto-progetto
    const [firstStage] = await odoo.execute('erpv6.acquisition.stage', 'search_read', [
      [['relation_id', '=', relationId]],
      ['id', 'name'],
      0, 1, 'sequence asc, id asc',
    ]);
    if (!firstStage) return NextResponse.json({ success: false, error: 'Sotto-progetto senza fasi' }, { status: 400 });

    // 3) esiste già?
    const exists = await odoo.execute('erpv6.acquisition.lead', 'search_count', [
      [['relation_id', '=', relationId], ['partner_id', '=', partnerId]],
    ]);
    if (exists) return NextResponse.json({ success: false, error: 'Azienda già in pipeline di questo sotto-progetto' }, { status: 409 });

    // 4) crea lead con call_id + nota sbocco (se presente)
    const vals: any = {
      relation_id: relationId,
      partner_id: partnerId,
      stage_id: firstStage.id,
      call_id: callId,
    };
    if (outcomeNoteId) {
      const [note] = await odoo.execute('erpv6.call.note', 'read', [[outcomeNoteId], ['body']]);
      if (note?.body) vals.notes = note.body;
    }

    const leadId = await odoo.execute('erpv6.acquisition.lead', 'create', [vals]);

    return NextResponse.json({ success: true, leadId, stageId: firstStage.id, partnerId });
  } catch (e: any) {
    console.error('generate-lead error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
