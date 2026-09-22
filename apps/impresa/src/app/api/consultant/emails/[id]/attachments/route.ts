import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ attachments: [] });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const result = await callOdooAPI(`/api/v1/consultant/emails/${params.id}/attachments`, {
            method: 'GET', headers: { Authorization: authHeader },
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ attachments: [], error: error.message });
    }
}
