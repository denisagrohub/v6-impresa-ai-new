import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';

// Proxy verso /api/v1/partnership-candidacy su erpv6_api_gateway (09/09/2026,
// prompt "Candidatura partnership + routing token prodotto + rotazione
// claim homepage", Parte A). Scope volutamente minimo: raccoglie interesse,
// nessun accesso al sistema, nessun consulente creato automaticamente -
// callOdooAPI propaga l'errore reale (mai un { success: true } fabbricato,
// vedi commento in odoo-adapter.ts), quindi qui non c'e' nessun fallback
// su coda locale come per i lead: se Odoo non risponde, il chiamante deve
// saperlo davvero, non nascondere la candidatura persa in un log.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, company_name, email, phone, proposal } = body;

        if (!name || !email) {
            return NextResponse.json(
                { error: 'Nome ed email sono obbligatori' },
                { status: 400 }
            );
        }

        const result = await callOdooAPI('/api/v1/partnership-candidacy', {
            method: 'POST',
            body: JSON.stringify({ name, company_name, email, phone, proposal }),
        });

        return NextResponse.json({ success: true, id: result?.data?.id });
    } catch (error) {
        console.error('Errore invio candidatura partnership:', error);
        return NextResponse.json(
            { error: 'Impossibile inviare la candidatura al momento. Riprova più tardi o scrivici direttamente.' },
            { status: 502 }
        );
    }
}
