import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Approva/rifiuta una erpv6.consulente.richiesta - azione riservata a
// Responsabile/Admin (compito "dashboard consulente", criterio 3: stessa
// pagina, azioni in piu' per il suo ruolo). Il controllo VERO resta lato
// Odoo (action_approve/action_reject con with_user(user), vedi
// consultant_api.py): questa route inoltra solo l'Authorization, non decide
// nulla lei stessa - un Consulente che la chiama comunque riceve un 403
// reale da Odoo, non un finto successo.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const richiestaId = Number(id);
    if (!Number.isInteger(richiestaId)) {
        return NextResponse.json({ error: 'id non valido' }, { status: 400 });
    }
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    try {
        const result = await callOdooAPI(`/api/v1/consultant/richieste/${richiestaId}/decide`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { Authorization: authHeader },
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error(`Errore /api/consultant/richieste/${richiestaId}/decide:`, error);
        const message = String(error?.message || '');
        const status = message.includes(' 403 ') ? 403 : message.includes(' 404 ') ? 404 : 502;
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status });
    }
}
