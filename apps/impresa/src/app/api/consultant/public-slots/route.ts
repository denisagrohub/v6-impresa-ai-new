import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Collegato per davvero a Odoo il 25/08/2026 (Denis: "il tab calendario/
// call e' l'unico pezzo da salvare/rendere reale ora"). Prima leggeva/
// scriveva su un file JSON locale (src/data/consultant-calendar.json),
// mai su Odoo. Il modello reale (erpv6.booking.token, erpv6_booking) e'
// un link di prenotazione monouso con sola scadenza (validity_hours) -
// NON un calendario con giorno/ora: niente campo data/ora esiste oggi sul
// modello Odoo, quindi questa route non fabbrica piu' slot con orari
// finti. "Slot pubblico" qui significa "link di prenotazione disponibile,
// valido fino a una scadenza reale" - vedi report finale per la
// discrepanza rispetto a come questa route si comportava prima.
export async function GET(request: NextRequest) {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    const { searchParams } = new URL(request.url);
    // consultantId qui e' l'id reale di erpv6.consulting.consultant (non
    // piu' un codice finto tipo "PART-004") - vedi /booking/[consultantId].
    const consultantId = searchParams.get('consultantId');
    if (!consultantId) {
        return NextResponse.json({ error: 'consultantId richiesto' }, { status: 400 });
    }
    try {
        const result = await callOdooAPI(
            `/api/v1/booking/tokens?consultant_id=${encodeURIComponent(consultantId)}`,
            { method: 'GET' }
        );
        return NextResponse.json({
            consultantName: result.data.consultant_name,
            tokens: result.data.tokens,
        });
    } catch (error: any) {
        console.error('Errore /api/consultant/public-slots GET:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}

// Genera nuovi link di prenotazione reali per il consulente autenticato
// (JWT nell'Authorization header, propagato dal chiamante) - vedi
// POST /api/v1/booking/generate lato erpv6_api_gateway.
export async function POST(request: NextRequest) {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Sessione mancante: effettua di nuovo il login' }, { status: 401 });
    }
    let body: any;
    try {
        body = await request.json();
    } catch {
        body = {};
    }
    try {
        const result = await callOdooAPI('/api/v1/booking/generate', {
            method: 'POST',
            body: JSON.stringify({ count: body.count || 1, validity_hours: body.validityHours || 24 }),
            headers: { Authorization: authHeader },
        });
        return NextResponse.json({ success: true, tokens: result.data.tokens });
    } catch (error: any) {
        console.error('Errore /api/consultant/public-slots POST:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
