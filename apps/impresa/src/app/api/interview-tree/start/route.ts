import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso POST /api/v1/interview/start - crea (o riusa) il
// lead grezzo e avvia una erpv6.interview.session. Nessun dato finto: se
// Odoo non e' raggiungibile o risponde con errore, lo propaghiamo cosi'
// com'e' al frontend (stessa disciplina di lib/odoo-adapter.ts) invece di
// fabbricare un {success:true} di comodo.
//
// Resta pubblico (nessuna sessione richiesta, vedi middleware.ts): se pero'
// il chiamante e' gia' un consulente/admin loggato (dashboard, compito
// 25/08/2026 "dashboard consulente"), tree-client.ts/startInterview passa un
// Authorization: JWT <token> che qui viene solo INOLTRATO a Odoo - la
// decisione se/come attribuire il lead resta interamente lato
// interview_api.py, mai dedotta qui.
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
    const authHeader = request.headers.get('authorization');
    try {
        const result = await callOdooAPI('/api/v1/interview/start', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: authHeader ? { Authorization: authHeader } : undefined,
        });
        if (!result?.success) {
            return NextResponse.json({ error: result?.error || 'Avvio intervista fallito' }, { status: 502 });
        }
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore /api/interview-tree/start:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
