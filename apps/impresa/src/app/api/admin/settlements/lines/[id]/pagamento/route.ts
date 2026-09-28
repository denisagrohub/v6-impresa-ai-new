import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const body = await request.text();
        const result = await callOdooAPI(`/api/v1/admin/settlements/lines/${params.id}/pagamento`, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: body || '{}',
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        // 28/09/2026: se Odoo risponde con errore business (400), il messaggio
        // contiene "400 Bad Request". Lo estraiamo e lo ritorniamo con status 400.
        const msg = String(error?.message || 'Errore');
        if (msg.includes('400')) {
            // Estrai il messaggio HTML di Odoo se presente
            const clean = msg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return NextResponse.json({ error: clean }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 502 });
    }
}
