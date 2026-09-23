import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    try {
        const r = await callOdooAPI(`/api/v1/auth/magic-link/${params.token}`, { method: 'GET' });
        return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Link non valido' }, { status: 404 });
    }
}
