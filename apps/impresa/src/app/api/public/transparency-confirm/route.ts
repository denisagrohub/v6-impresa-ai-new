import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

// 28/09/2026: proxy pubblico per conferma consenso condivisione quote.
// Forward a Odoo endpoint pubblico /api/v1/public/transparency-confirm
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const r = url.searchParams.get('r') || '';

    if (!isOdooEnabled()) {
        return NextResponse.json({ error: 'Servizio non disponibile' }, { status: 503 });
    }

    try {
        const odooUrl = SYSTEM_CONFIG.ODOO.URL.replace(/\/$/, '');
        const target = `${odooUrl}/api/v1/public/transparency-confirm?token=${encodeURIComponent(token)}&r=${encodeURIComponent(r)}`;
        const odooResp = await fetch(target, { method: 'GET' });
        const html = await odooResp.text();
        return new NextResponse(html, {
            status: odooResp.status,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch (error: any) {
        return new NextResponse(
            '<html><body><h2>Errore di connessione</h2><p>Riprova tra qualche minuto.</p></body></html>',
            { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}
