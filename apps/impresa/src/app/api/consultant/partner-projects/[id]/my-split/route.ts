import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const r = await callOdooAPI(`/api/v1/consultant/projects/${params.id}/my-split`, {
            method: 'GET', headers: { Authorization: authHeader },
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 502 });
    }
}
