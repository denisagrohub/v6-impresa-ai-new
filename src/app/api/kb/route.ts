import { NextRequest, NextResponse } from 'next/server';
import { loadKBWithAccess } from '@/data/kb/loader';
import type { UserRole } from '@/data/kb/access-control';

export async function GET(request: NextRequest) {
    try {
        const module = request.nextUrl.searchParams.get('module');
        const roleParam = request.nextUrl.searchParams.get('role') || 'client';
        const role = roleParam as UserRole;

        if (!module) {
            return NextResponse.json({ error: 'Parametro module mancante' }, { status: 400 });
        }

        const data = loadKBWithAccess(module, role);
        return NextResponse.json({ module, data });
    } catch (error: any) {
        const status = error.message?.includes('Accesso negato') ? 403 :
            error.message?.includes('non trovata') ? 404 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}
