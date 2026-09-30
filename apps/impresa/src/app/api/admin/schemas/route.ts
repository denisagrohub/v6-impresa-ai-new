import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const r = await callOdooAPI('/api/v1/admin/schemas', {
            method: 'GET', headers: { Authorization: auth },
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
