import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const qs = request.nextUrl.searchParams.toString();
        const path = qs
            ? `/api/v1/admin/emails/${params.id}/mark-unread?${qs}`
            : `/api/v1/admin/emails/${params.id}/mark-unread`;
        const result = await callOdooAPI(path, { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: '{}' });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 502 });
    }
}
