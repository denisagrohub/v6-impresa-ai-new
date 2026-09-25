import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled } from '@/config/system';

const ODOO_URL = process.env.NEXT_PUBLIC_API_URL || 'https://erp.v6sviluppoimpresa.it';

// 25/09/2026: proxy download PDF firmato. Inoltra l'header Authorization
// JWT a Odoo, che verifica che il sign request appartenga al consulente
// loggato e sia in stato 'signed'. Ritorna il PDF come stream.
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    if (!isOdooEnabled()) {
        return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    }
    try {
        const res = await fetch(
            `${ODOO_URL}/api/v1/consultant/sign-requests/${params.id}/download`,
            {
                method: 'GET',
                headers: { Authorization: authHeader },
            }
        );
        if (!res.ok) {
            const text = await res.text();
            return new NextResponse(text, { status: res.status });
        }
        const buffer = await res.arrayBuffer();
        const filename = res.headers.get('content-disposition') || '';
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': filename || 'attachment',
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Errore download' },
            { status: 502 }
        );
    }
}
