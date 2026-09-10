import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Pubblica (nessuna sessione admin): il token stesso e' l'unico segreto
// (non enumerabile, stesso principio gia' in uso per /report/[token]).
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token) return NextResponse.json({ success: false, error: 'Token mancante' }, { status: 400 });

  try {
    await odoo.connect();
    const tokens = await odoo.execute('erpv6.booking.token', 'search_read', [
      [['confirmation_token', '=', token]],
      ['id', 'client_name', 'consultant_id', 'scheduled_at', 'confirmation_state', 'reschedule_note'],
      0, 1,
    ]);
    const booking = tokens && tokens[0];
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Link non valido o scaduto' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      booking: {
        clientName: booking.client_name || '',
        consultant: Array.isArray(booking.consultant_id) ? booking.consultant_id[1] : '—',
        scheduledAt: booking.scheduled_at || null,
        confirmationState: booking.confirmation_state,
        rescheduleNote: booking.reschedule_note || '',
      },
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/booking-confirm/[token]:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione' }, { status: 503 });
  }
}
