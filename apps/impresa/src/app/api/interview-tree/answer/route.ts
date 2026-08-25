import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso POST /api/v1/interview/answer - registra la
// risposta alla domanda corrente della sessione e ritorna la prossima (o
// completed=true). Stessa disciplina di start/route.ts: nessun fallback
// silenzioso in modalita' Odoo reale, l'errore va sempre al chiamante.
//
// Timeout esteso (20s invece del default 5s, vedi lib/odoo-adapter.ts): una
// risposta con is_altro=true su un termine mai visto fa scattare lato Odoo
// erpv6.vocabulary.entry._run_deep_source, un fetch sincrono a Wikipedia
// (interview_engine.py) - misurato oltre i 5s la prima volta per un
// termine nuovo. Non e' un dato finto ne' un retry silenzioso: e' solo
// tempo dato in piu' a una chiamata reale che sappiamo poter essere lenta.
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
    try {
        const result = await callOdooAPI(
            '/api/v1/interview/answer',
            { method: 'POST', body: JSON.stringify(body) },
            { timeout: 20000 }
        );
        if (!result?.success) {
            return NextResponse.json({ error: result?.error || 'Invio risposta fallito' }, { status: 502 });
        }
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore /api/interview-tree/answer:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
