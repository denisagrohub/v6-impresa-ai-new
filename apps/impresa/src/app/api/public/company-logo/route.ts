import { NextResponse } from 'next/server';
import { isOdooEnabled, SYSTEM_CONFIG } from '@/config/system';

export async function GET() {
    if (!isOdooEnabled()) {
        return new NextResponse('Odoo non configurato', { status: 503 });
    }
    try {
        const odooUrl = SYSTEM_CONFIG.ODOO.URL.replace(/\/$/, '');
        const r = await fetch(`${odooUrl}/api/v1/public/company-logo`, {
            method: 'GET',
            cache: 'no-store',
        });
        if (!r.ok) {
            return new NextResponse('Logo non disponibile', { status: r.status });
        }
        const buffer = await r.arrayBuffer();
        const contentType = r.headers.get('content-type') || 'image/png';
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            },
        });
    } catch {
        return new NextResponse('Errore connessione', { status: 502 });
    }
}
