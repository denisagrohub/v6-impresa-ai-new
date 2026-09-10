import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso POST /api/v1/interview/upload - Denis, 10/09/2026:
// "upload documenti manca anche su una domanda dell'intervista guidata".
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
            '/api/v1/interview/upload',
            { method: 'POST', body: JSON.stringify(body) },
            { timeout: 20000 }
        );
        if (!result?.success) {
            return NextResponse.json({ error: result?.error || 'Caricamento fallito' }, { status: 502 });
        }
        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error('Errore /api/interview-tree/upload:', error);
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
