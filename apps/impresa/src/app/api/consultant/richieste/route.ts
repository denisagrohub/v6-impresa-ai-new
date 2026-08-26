import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Collegato per davvero a Odoo il 25/08/2026 (compito "dashboard
// consulente", tab Richieste): erpv6.consulente.richiesta reali - un
// Consulente vede/crea solo le proprie, un Responsabile/Admin le vede tutte
// per default (deve poterle approvare, vedi
// consultant_api.py/consultant_richieste). Richiede sempre
// Authorization: JWT <token> della sessione.
export async function GET(request: NextRequest) {
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
    try {
        const result = await callOdooAPI('/api/v1/consultant/richieste', {
            method: 'GET',
            headers: { Authorization: authHeader },
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore GET /api/consultant/richieste:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}

// Crea una richiesta 'assegnami'/'non_assegnarmi' su un lead specifico -
// SOLO per il consulente autenticato (consulente_id risolto lato Odoo dal
// JWT, mai passato dal client, vedi consultant_api.py).
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
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    try {
        const result = await callOdooAPI('/api/v1/consultant/richieste', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { Authorization: authHeader },
        });
        return NextResponse.json(result.data, { status: 201 });
    } catch (error: any) {
        console.error('Errore POST /api/consultant/richieste:', error);
        const message = String(error?.message || '');
        const status = message.includes(' 400 ') ? 400 : 502;
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status });
    }
}
