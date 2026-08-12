import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!fs.existsSync(PARTNERS_PATH)) {
            return NextResponse.json({ valid: false, error: 'Dati non trovati' }, { status: 404 });
        }

        const partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
        const consultant = partnersData.partners.find((p: any) => p.onboardingToken === token);

        if (!consultant) {
            return NextResponse.json({ valid: false, error: 'Token non valido' }, { status: 404 });
        }

        if (new Date(consultant.onboardingExpiresAt) < new Date()) {
            return NextResponse.json({ valid: false, error: 'Token scaduto' }, { status: 410 });
        }

        if (consultant.status !== 'pending_onboarding') {
            return NextResponse.json({ valid: false, error: 'Questo link è già stato utilizzato' }, { status: 400 });
        }

        return NextResponse.json({
            valid: true,
            consultant: {
                id: consultant.id,
                name: consultant.name,
                email: consultant.email,
                company: consultant.company
            }
        });
    } catch (error) {
        return NextResponse.json({ valid: false, error: 'Errore del server' }, { status: 500 });
    }
}
