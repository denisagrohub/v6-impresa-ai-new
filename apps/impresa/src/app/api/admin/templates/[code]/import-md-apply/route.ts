import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest, { params }: { params: { code: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const body = await request.text();
        const result = await callOdooAPI(`/api/v1/admin/templates/${params.code}/import-md-apply`, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body,
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 502 });
    }
}
