import { NextRequest, NextResponse } from 'next/server';
import { saveLead, getPendingLeads, syncPendingLeads } from '@/lib/lead-queue';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { source, data } = body;

        if (!source || !data) {
            return NextResponse.json(
                { error: 'source e data sono obbligatori' },
                { status: 400 }
            );
        }

        const result = await saveLead(data, source);

        return NextResponse.json({
            success: true,
            queued: result.queued || false,
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
