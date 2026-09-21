import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }); }
    try {
        const result = await callOdooAPI('/api/v1/consultant/emails/send', {
            method: 'POST',
            headers: { Authorization: authHeader },
            body: JSON.stringify(body),
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
