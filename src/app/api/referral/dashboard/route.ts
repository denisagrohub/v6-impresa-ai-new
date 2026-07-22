import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MOCK_PATH = path.join(process.cwd(), 'src/data/referral-mock.json');
const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function GET(request: NextRequest) {
    try {
        if (!fs.existsSync(MOCK_PATH)) {
            return NextResponse.json({ error: 'Dati referral non trovati' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(MOCK_PATH, 'utf-8'));

        // Leggi il profilo partner per aggiornare la % provvigione
        if (fs.existsSync(PARTNERS_PATH)) {
            const partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
            const partner = partnersData.partners.find((p: any) => p.id === data.referral.id);

            if (partner && partner.commissionRate) {
                data.referral.commissionRate = partner.commissionRate;
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Errore API Referral:', error);
        return NextResponse.json({ error: 'Errore server' }, { status: 500 });
    }
}
