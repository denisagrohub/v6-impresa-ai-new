import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'src/data/accounting-commissions.json');

// GET: Lista provvigioni consulenti con filtri (partnerId, status)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const partnerId = searchParams.get('partnerId');
        const status = searchParams.get('status');

        if (!fs.existsSync(DATA_PATH)) {
            return NextResponse.json({ commissions: [] });
        }

        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        let commissions = data.commissions || [];

        // Applica filtri
        if (partnerId) {
            commissions = commissions.filter((c: any) => c.partnerId === partnerId);
        }
        if (status) {
            commissions = commissions.filter((c: any) => c.status === status);
        }

        return NextResponse.json({ commissions });
    } catch (error: any) {
        console.error('Errore lettura provvigioni:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
