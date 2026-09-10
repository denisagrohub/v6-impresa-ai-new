import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "manca in dashboard una vista per i slot prenotati
// e con i dati di chi lo ha prenotato") - tutti gli slot prenotati
// (erpv6.booking.token, status='booked') con i dati reali di chi ha
// prenotato, su tutti i consulenti.
export async function GET() {
  try {
    await odoo.connect();
    const tokens = await odoo.execute('erpv6.booking.token', 'search_read', [
      [['status', '=', 'booked']],
      ['id', 'token', 'consultant_id', 'client_name', 'client_email', 'client_phone', 'notes', 'booked_at', 'expires_at',
       'scheduled_at', 'confirmation_state', 'reschedule_note'],
      0, 200, 'booked_at desc',
    ]);
    return NextResponse.json({
      success: true,
      bookings: (tokens || []).map((t: any) => ({
        id: t.id,
        consultant: Array.isArray(t.consultant_id) ? t.consultant_id[1] : '—',
        consultantId: Array.isArray(t.consultant_id) ? t.consultant_id[0] : null,
        clientName: t.client_name || '',
        clientEmail: t.client_email || '',
        clientPhone: t.client_phone || '',
        notes: t.notes || '',
        bookedAt: t.booked_at || null,
        expiresAt: t.expires_at || null,
        scheduledAt: t.scheduled_at || null,
        confirmationState: t.confirmation_state,
        rescheduleNote: t.reschedule_note || '',
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/bookings:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
