import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    try {
        const r = await callOdooAPI(`/api/v1/public/verify/${params.token}`, { method: 'GET' });
        return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Non trovato' }, { status: 404 });
    }
}
