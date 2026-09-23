import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// 23/09/2026: force-dynamic per evitare che Next.js/Vercel cachi la
// risposta del pitch pubblico. Il charter puo' cambiare nel DB e la
// pagina pubblica deve rifletterlo subito, senza redeploy.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { alias: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    try {
        const result = await callOdooAPI(`/api/v1/public/project/${params.alias}/pitch`, { method: 'GET' });
        return NextResponse.json(result.data, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Errore' }, { status: 404 });
    }
}
