import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// POST /api/admin/calls/[id]/promote-note
// body: { noteId, section, field, partnerId, mode: 'append' | 'replace' }
// Promuove una nota a un campo scouting di res.partner (versionato con data).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const callId = parseInt(params.id, 10);
  if (!callId) return NextResponse.json({ success: false, error: 'ID call non valido' }, { status: 400 });

  try {
    const { noteId, section, field, partnerId, mode = 'append' } = await request.json();
    if (!noteId || !section || !field || !partnerId) {
      return NextResponse.json({ success: false, error: 'noteId/section/field/partnerId obbligatori' }, { status: 400 });
    }

    await odoo.connect();

    // 1) leggi nota + scouting attuale
    const [note] = await odoo.execute('erpv6.call.note', 'read', [[noteId], ['body']]);
    const [partner] = await odoo.execute('res.partner', 'read', [[partnerId], ['x_v6_scouting', 'name']]);
    if (!note || !partner) return NextResponse.json({ success: false, error: 'Nota o partner non trovati' }, { status: 404 });

    let scouting: any = {};
    if (partner.x_v6_scouting) {
      try { scouting = JSON.parse(partner.x_v6_scouting); } catch { scouting = {}; }
    }
    scouting.schemaVersion = scouting.schemaVersion || 1;
    scouting.version = (scouting.version || 0) + 1;
    scouting.savedAt = new Date().toISOString();
    scouting[section] = scouting[section] || {};

    const newValue = note.body.trim();
    const dateStr = new Date().toLocaleDateString('it-IT');
    const existing = scouting[section][field] || '';

    if (mode === 'append' && existing && !existing.includes(newValue)) {
      scouting[section][field] = `${existing} | ${newValue} (call ${dateStr})`;
    } else {
      scouting[section][field] = newValue;
    }

    // provenance
    scouting.provenance = scouting.provenance || {};
    scouting.provenance[field] = {
      valore: scouting[section][field],
      fonte: `call ${callId} del ${dateStr}`,
      data: new Date().toISOString(),
    };

    // 2) salva scouting
    await odoo.execute('res.partner', 'write', [[partnerId], {
      x_v6_scouting: JSON.stringify(scouting),
    }]);

    // 3) marca la nota come promossa
    await odoo.execute('erpv6.call.note', 'write', [[noteId], {
      promoted_to: section === 'outcome' ? 'outcome' : `scouting_${section}`,
      promoted_field: field,
    }]);

    return NextResponse.json({ success: true, scouting });
  } catch (e: any) {
    console.error('calls/promote-note error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
