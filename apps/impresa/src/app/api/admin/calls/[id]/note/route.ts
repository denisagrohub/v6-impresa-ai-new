import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/calls/[id]/note — aggiunge una nota
// body: { body, promotedTo?: 'outcome' | 'scouting_*' | ... }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const callId = parseInt(params.id, 10);
  if (!callId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    const { body, promotedTo } = await request.json();
    if (!body?.trim()) return NextResponse.json({ success: false, error: 'body obbligatorio' }, { status: 400 });

    const vals: any = { call_id: callId, body: body.trim() };
    if (promotedTo) vals.promoted_to = promotedTo;

    await odoo.connect();
    const noteId = await odoo.execute('erpv6.call.note', 'create', [vals]);
    return NextResponse.json({ success: true, noteId });
  } catch (e: any) {
    console.error('calls/note error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}

// GET /api/admin/calls/[id]/note — lista note della call (polling)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const callId = parseInt(params.id, 10);
  if (!callId) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const notes = await odoo.execute('erpv6.call.note', 'search_read', [
      [['call_id', '=', callId]],
      ['id', 'body', 'captured_at', 'promoted_to', 'promoted_field'],
      0, 0, 'captured_at asc',
    ]);
    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
