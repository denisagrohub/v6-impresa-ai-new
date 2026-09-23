import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 23/09/2026: force-dynamic per evitare cache Vercel/Next sui dati
// del playbook (bug visto: la risposta di un progetto veniva servita
// per un altro id).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const result = await callOdooAPI(`/api/v1/consultant/projects/${params.id}/playbook`, {
            method: 'GET', headers: { Authorization: authHeader },
        });
        return NextResponse.json(result.data, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Errore' }, { status: 502 });
    }
}
