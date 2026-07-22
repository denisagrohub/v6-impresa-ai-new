import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function POST(request: NextRequest) {
    try {
        const { token, password, cvUploaded, acceptedTerms } = await request.json();

        if (!fs.existsSync(PARTNERS_PATH)) {
            return NextResponse.json({ error: 'Dati non trovati' }, { status: 404 });
        }

        const partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
        const index = partnersData.partners.findIndex((p: any) => p.onboardingToken === token);

        if (index === -1) {
            return NextResponse.json({ error: 'Token non valido' }, { status: 404 });
        }

        // Aggiorna il record del consulente
        partnersData.partners[index] = {
            ...partnersData.partners[index],
            status: 'active', // Ora è attivo
            password: password, // ⚠️ In produzione: usa bcrypt.hash(password, 10)
            cvUploaded: cvUploaded,
            acceptedTerms: acceptedTerms,
            onboardingToken: null, // Invalida il token
            onboardingExpiresAt: null,
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(PARTNERS_PATH, JSON.stringify(partnersData, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Errore completamento onboarding:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
