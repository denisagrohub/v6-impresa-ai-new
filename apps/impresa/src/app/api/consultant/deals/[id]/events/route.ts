import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const r = await callOdooAPI(`/api/v1/consultant/deals/${params.id}/events`, {
            method: 'GET', headers: { Authorization: auth },
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const body = await request.json();
        const r = await callOdooAPI(`/api/v1/consultant/deals/${params.id}/events`, {
            method: 'POST',
            headers: { Authorization: auth, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
