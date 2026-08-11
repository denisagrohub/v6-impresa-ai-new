import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { url, db, key } = await request.json();

        if (!url || !db || !key) {
            return NextResponse.json({ success: false, error: 'Dati incompleti' });
        }

        // Simulazione chiamata a Odoo (XML-RPC o JSON-RPC)
        // Per ora facciamo un semplice fetch all'endpoint /web/session/authenticate
        const response = await fetch(`${url}/web/session/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: {
                    db: db,
                    login: 'admin', // In futuro prenderemo il login dal config
                    password: key   // Usiamo la API key come password per il test
                },
                id: 1
            })
        });

        const data = await response.json();

        if (data.result && data.result.uid) {
            return NextResponse.json({ success: true, dbName: db });
        } else {
            return NextResponse.json({
                success: false,
                error: data.error?.data?.message || 'Credenziali non valide'
            });
        }
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Impossibile raggiungere il server Odoo'
        });
    }
}
