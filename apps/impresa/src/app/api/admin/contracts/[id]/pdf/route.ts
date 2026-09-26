import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled } from '@/config/system';

const ODOO_URL = process.env.NEXT_PUBLIC_API_URL || 'https://erp.v6sviluppoimpresa.it';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    try {
        const res = await fetch(`${ODOO_URL}/api/v1/admin/contracts/${params.id}/pdf`, {
            headers: { Authorization: authHeader || '' },
        });
        if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
        const buffer = await res.arrayBuffer();
        const cd = res.headers.get('content-disposition') || 'attachment';
        return new NextResponse(buffer, {
            status: 200,
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': cd },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 502 });
    }
}
