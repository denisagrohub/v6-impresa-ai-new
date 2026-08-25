import { NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso GET /api/v1/interview/products (erpv6_api_gateway /
// erpv6.vertical.catalog) - radice della scelta prodotto per l'intervista
// ad albero (vedi odoo-modules/erpv6_api_gateway/controllers/interview_api.py).
// L'endpoint Odoo avvolge sempre la risposta in {success, data, timestamp}
// (vedi APIBaseController._json_response): qui la spacchettiamo, non la
// trattiamo come se fosse gia' l'array (bug osservato nell'analogo
// /api/verticals/route.ts, che confronta Array.isArray() sull'intero
// inviluppo e quindi ritorna sempre [] in modalita' Odoo reale).
export async function GET() {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    try {
        const result = await callOdooAPI('/api/v1/interview/products', { method: 'GET' });
        return NextResponse.json(Array.isArray(result?.data) ? result.data : []);
    } catch (error: any) {
        console.error('Errore /api/interview-tree/products:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
