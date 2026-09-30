import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const qs = request.nextUrl.searchParams.toString();
        const path = qs
            ? `/api/v1/admin/relations/${params.id}/suggest-schema?${qs}`
            : `/api/v1/admin/relations/${params.id}/suggest-schema`;
        const r = await callOdooAPI(path, {
            method: 'GET', headers: { Authorization: auth },
        });
        return NextResponse.json(r.data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
