import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso GET /api/v1/winwin-report/status (prompt web-async,
// 06/09/2026). Endpoint LEGGERO per costruzione (un solo lookup lato Odoo,
// mai lavoro pesante) - il frontend lo chiama UNA VOLTA SOLA dopo l'attesa
// fissa, mai in un ciclo di polling continuo (vedi InterviewTreeFlow.tsx).
export async function GET(request: NextRequest) {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.json({ error: 'token mancante' }, { status: 400 });
    }
    try {
        const result = await callOdooAPI(
            `/api/v1/winwin-report/status?token=${encodeURIComponent(token)}`,
            { method: 'GET' },
            { timeout: 8000 }
        );
        if (!result?.success) {
            return NextResponse.json({ error: result?.error || 'Stato non disponibile' }, { status: 502 });
        }
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore /api/winwin-report/status:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
