import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const r = await callOdooAPI('/api/v1/consultant/me/fiscal-data', {
            method: 'GET', headers: { Authorization: authHeader },
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }); }
    try {
        const r = await callOdooAPI('/api/v1/consultant/me/fiscal-data', {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 502 });
    }
}
