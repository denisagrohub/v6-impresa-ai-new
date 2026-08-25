import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Login reale contro Odoo (Denis, 25/08/2026 - un consulente vero, es.
// Stefano Puglisi/Martina Garbin, deve poter accedere a V6 Impresa e
// arrivare alla propria area consulente). Prima di questa route il login
// del frontend era interamente hardcoded (vedi /login/page.tsx prima della
// fix: 3 credenziali demo scritte nel codice, nessuna verifica contro
// Odoo). Questa route e' un proxy verso POST /api/v1/auth/login
// (erpv6_api_gateway) - stesso pattern gia' in uso su
// /api/interview-tree/start: nessun successo fabbricato, un errore/
// credenziali sbagliate vengono propagati cosi' come sono.
export async function POST(request: NextRequest) {
    if (!isOdooEnabled()) {
        return NextResponse.json(
            { error: 'Odoo non configurato (NEXT_PUBLIC_USE_ODOO / ODOO_API_KEY mancanti)' },
            { status: 503 }
        );
    }
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    const { email, password } = body || {};
    if (!email || !password) {
        return NextResponse.json({ error: 'Email e password sono obbligatori' }, { status: 400 });
    }

    try {
        const result = await callOdooAPI('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ login: email, password }),
        });
        const { token, user } = result.data;
        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                partnerId: user.partner_id,
                consultantId: user.consultant_id, // erpv6.consulting.consultant.id, null se non ancora collegato
                role: user.role, // 'admin' | 'consultant' | 'client', deciso da Odoo sui gruppi reali
            },
        });
    } catch (error: any) {
        // callOdooAPI (per disciplina, vedi lib/odoo-adapter.ts) lancia
        // un'eccezione anche su un 401 legittimo (credenziali sbagliate,
        // non un errore di rete) - qui distinguiamo i due casi invece di
        // restituire sempre un generico 502: un utente che sbaglia
        // password deve vedere "credenziali non valide", non un errore
        // di connessione.
        const message = String(error?.message || '');
        const jsonMatch = message.match(/\{.*\}$/);
        let odooError: string | undefined;
        if (jsonMatch) {
            try {
                odooError = JSON.parse(jsonMatch[0])?.data?.error;
            } catch { /* messaggio non JSON, ignora */ }
        }
        if (message.includes(' 401 ')) {
            return NextResponse.json({ error: odooError || 'Credenziali non valide' }, { status: 401 });
        }
        console.error('Errore /api/auth/login:', error);
        return NextResponse.json({ error: odooError || error.message || 'Odoo non raggiungibile' }, { status: 502 });
    }
}
