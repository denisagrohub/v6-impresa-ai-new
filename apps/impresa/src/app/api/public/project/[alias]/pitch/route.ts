import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(_req: NextRequest, { params }: { params: { alias: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    try {
        const result = await callOdooAPI(`/api/v1/public/project/${params.alias}/pitch`, { method: 'GET' });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Errore' }, { status: 404 });
    }
}
