import { NextRequest, NextResponse } from 'next/server';
import { updateLead } from '@/lib/lead-queue';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const leadId = Number(id);
        if (!Number.isInteger(leadId)) {
            return NextResponse.json({ error: 'id non valido' }, { status: 400 });
        }

        const data = await request.json();
        const result = await updateLead(leadId, data);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Impossibile aggiornare il lead al momento.' },
                { status: 502 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Errore aggiornamento lead:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
