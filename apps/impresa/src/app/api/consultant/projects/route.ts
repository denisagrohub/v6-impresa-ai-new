import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Collegato per davvero a Odoo il 25/08/2026 (compito "dashboard
// consulente", tab Progetti): erpv6.production.order/crm.lead reali del
// consulente autenticato (o di TUTTI, se Responsabile/Admin passa
// ?all=1 - vedi consultant_api.py/get_consultant_projects). Richiede
// l'Authorization: JWT <token> della sessione (pi_session.token) - senza,
// Odoo risponde 401 e questa route lo propaga cosi' com'e', mai un
// {success:true} fabbricato.
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
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all');
    try {
        const result = await callOdooAPI(
            `/api/v1/consultant/projects${all ? `?all=${encodeURIComponent(all)}` : ''}`,
            { method: 'GET', headers: { Authorization: authHeader } }
        );
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore /api/consultant/projects:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
