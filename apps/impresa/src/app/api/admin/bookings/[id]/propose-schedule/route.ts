import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "dobbiamo inserire l'orario e il giorno... avere
// anche la possibilità di modificare orario data e consulente, ogni
// cambiamento deve essere comunicato anche al lead"): riusa
// action_propose_schedule() gia' reale (aeosv6_booking) - manda
// davvero l'email al cliente con il link di conferma pubblico.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { scheduledAt, consultantId } = body || {};
  if (!scheduledAt) {
    return NextResponse.json({ success: false, error: 'Data/ora obbligatoria' }, { status: 400 });
  }

  try {
    await odoo.connect();
    // Odoo si aspetta 'YYYY-MM-DD HH:MM:SS' in UTC - il client manda un
    // datetime-local (ora del browser, assunta Europe/Rome); qui non
    // viene fatta nessuna conversione timezone aggiuntiva: stesso limite
    // gia' presente altrove nel progetto, accettato per ora.
    const odooDatetime = String(scheduledAt).replace('T', ' ').slice(0, 19);
    await odoo.execute('erpv6.booking.token', 'action_propose_schedule', [
      [id], odooDatetime, consultantId ? Number(consultantId) : false,
    ]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore POST propose-schedule:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Operazione fallita' }, { status: 502 });
  }
}
