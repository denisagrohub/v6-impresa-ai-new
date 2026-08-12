import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = await params;
        const { action } = await request.json(); // 'promote' o 'demote'

        if (!['promote', 'demote'].includes(action)) {
            return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
        }

        if (!fs.existsSync(PARTNERS_PATH)) {
            return NextResponse.json({ error: 'Database non trovato' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
        const index = data.partners.findIndex((p: any) => p.id === id);

        if (index === -1) {
            return NextResponse.json({ error: 'Consulente non trovato' }, { status: 404 });
        }

        const consultant = data.partners[index];

        // Verifica che sia un consulente
        if (consultant.type !== 'consultant') {
            return NextResponse.json({ error: 'Solo i consulenti possono essere promossi' }, { status: 400 });
        }

        // Applica l'azione
        if (action === 'promote') {
            consultant.isChief = true;
            consultant.promotedAt = new Date().toISOString();
            consultant.promotedBy = 'admin';
        } else if (action === 'demote') {
            consultant.isChief = false;
            delete consultant.promotedAt;
            delete consultant.promotedBy;
        }

        data.partners[index] = consultant;
        fs.writeFileSync(PARTNERS_PATH, JSON.stringify(data, null, 2));

        return NextResponse.json({
            success: true,
            consultant,
            message: action === 'promote'
                ? `${consultant.name} è ora Chief Consultant`
                : `${consultant.name} è tornato Consulente`
        });
    } catch (error) {
        console.error('Errore promozione:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
