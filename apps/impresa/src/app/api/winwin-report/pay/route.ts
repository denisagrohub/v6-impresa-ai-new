import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso POST /api/v1/winwin-report/pay (09/09/2026,
// pagamento reale del report Win-Win, audit "Punto Zero"). Crea/riusa il
// sale.order del report e ritorna l'URL portale nativo Odoo dove il
// cliente paga con Stripe - stesso schema di status/data qui sopra.
export async function POST(request: NextRequest) {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    const body = await request.json().catch(() => ({}));
    const token = body?.token;
    if (!token) {
        return NextResponse.json({ error: 'token mancante' }, { status: 400 });
    }
    try {
        const result = await callOdooAPI(
            '/api/v1/winwin-report/pay',
            { method: 'POST', body: JSON.stringify({ token }) },
            { timeout: 8000 }
        );
        if (!result?.success) {
            return NextResponse.json({ error: result?.error || 'Impossibile avviare il pagamento' }, { status: 502 });
        }
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore /api/winwin-report/pay:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
