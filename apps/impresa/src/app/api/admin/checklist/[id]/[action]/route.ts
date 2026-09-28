import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

const VALID = ['complete', 'skip', 'start'];

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string; action: string } }
) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    if (!VALID.includes(params.action)) {
        return NextResponse.json({ error: `Azione non valida: ${params.action}` }, { status: 400 });
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const body = await request.text();
        const result = await callOdooAPI(
            `/api/v1/admin/checklist/${params.id}/${params.action}`,
            {
                method: 'POST',
                headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                body: body || '{}',
            }
        );
        if (result.data?.error) {
            return NextResponse.json(result.data, { status: 400 });
        }
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 502 });
    }
}
