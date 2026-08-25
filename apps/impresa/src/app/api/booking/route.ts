import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Collegato per davvero a Odoo il 25/08/2026 (vedi
// /api/consultant/public-slots per il contesto completo). Prima scriveva
// su src/data/consultant-calendar.json; ora la prenotazione e' una vera
// erpv6.booking.token.action_book() lato Odoo (POST /api/v1/booking/book).
export async function POST(request: NextRequest) {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    const { bookingToken, clientName, clientEmail, clientPhone, notes } = body || {};
    if (!bookingToken || !clientName || !clientEmail) {
        return NextResponse.json({ error: 'Token e dati cliente obbligatori' }, { status: 400 });
    }

    try {
        const result = await callOdooAPI('/api/v1/booking/book', {
            method: 'POST',
            body: JSON.stringify({
                token: bookingToken,
                client_name: clientName,
                client_email: clientEmail,
                client_phone: clientPhone,
                notes,
            }),
        });
        return NextResponse.json({ success: true, booking: result.data });
    } catch (error: any) {
        console.error('Errore /api/booking:', error);
        const message = String(error?.message || '');
        if (message.includes(' 404 ')) {
            return NextResponse.json({ error: 'Link non trovato o non piu\' valido' }, { status: 404 });
        }
        if (message.includes(' 400 ') || message.includes(' 410 ') || message.includes(' 409 ')) {
            return NextResponse.json({ error: 'Questo link non e\' piu\' disponibile' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Odoo non raggiungibile' }, { status: 502 });
    }
}
