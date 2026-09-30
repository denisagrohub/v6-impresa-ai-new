import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 30/09/2026 (Step B): proxy verso /api/v1/consultant/deal-checklists.
// Ritorna i deal del consulente con la sequenza step documentali
// (NCND → NDA → Contratto Quadro → Split V6 → Prospetto → Incasso).
export async function GET(request: NextRequest) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
    try {
        const result = await callOdooAPI('/api/v1/consultant/deal-checklists', {
            method: 'GET',
            headers: { Authorization: authHeader },
        });
        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
