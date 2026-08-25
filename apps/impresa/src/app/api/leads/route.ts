import { NextRequest, NextResponse } from 'next/server';
import { saveLead, getPendingLeads, syncPendingLeads, createPartialLead } from '@/lib/lead-queue';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { source, data, partial } = body;

        if (!source || !data) {
            return NextResponse.json(
                { error: 'source e data sono obbligatori' },
                { status: 400 }
            );
        }

        // Cattura anticipata per form a piu' fasi (vedi createPartialLead):
        // niente coda locale di fallback qui, il chiamante puo' semplicemente
        // riprovare o ripiegare sul submit finale completo.
        if (partial) {
            const partialResult = await createPartialLead(data);
            return NextResponse.json(partialResult);
        }

        const result = await saveLead(data, source);

        if (!result.success) {
            // saveLead non lancia mai: se arriva qui, né Odoo né il fallback
            // locale hanno funzionato. Il lead completo è comunque nei log
            // (console.error in saveLead), quindi non è un 500 muto.
            return NextResponse.json(
                { error: 'Impossibile salvare la richiesta al momento. Riprova più tardi o contattaci direttamente.' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            queued: result.queued || false,
            // Presente solo se salvato direttamente su Odoo (mai fabbricato
            // per un lead finito in coda locale, vedi saveLead in
            // lib/lead-queue.ts): e' il crm.lead id reale che
            // /intervista/guidata usa per proseguire sullo stesso lead
            // invece di crearne uno nuovo.
            leadId: result.leadId,
            message: result.queued
                ? 'Lead salvato in coda (Odoo non disponibile)'
                : 'Lead salvato con successo',
        });
    } catch (error) {
        console.error('Errore salvataggio lead:', error);
        return NextResponse.json(
            { error: 'Errore interno del server' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const pendingLeads = await getPendingLeads();
        return NextResponse.json({
            count: pendingLeads.length,
            leads: pendingLeads,
        });
    } catch (error) {
        console.error('Errore lettura lead pendenti:', error);
        return NextResponse.json(
            { error: 'Errore interno del server' },
            { status: 500 }
        );
    }
}

export async function PUT() {
    try {
        const result = await syncPendingLeads();
        return NextResponse.json({
            success: true,
            ...result,
            message: `${result.synced} lead sincronizzati, ${result.failed} falliti`,
        });
    } catch (error) {
        console.error('Errore sincronizzazione lead:', error);
        return NextResponse.json(
            { error: 'Errore interno del server' },
            { status: 500 }
        );
    }
}
