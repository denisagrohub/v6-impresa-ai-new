import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest, { params }: { params: { alias: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }); }
    try {
        const result = await callOdooAPI(`/api/v1/public/project/${params.alias}/candidacy`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Errore' }, { status: 502 });
    }
}
