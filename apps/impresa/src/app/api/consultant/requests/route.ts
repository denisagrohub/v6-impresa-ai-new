import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REQUESTS_PATH = path.join(process.cwd(), 'src/data/requests.json');

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const consultantId = searchParams.get('consultantId');

        if (!fs.existsSync(REQUESTS_PATH)) {
            return NextResponse.json({
                riskReports: [],
                transferRequests: [],
                discountRequests: []
            });
        }

        const data = JSON.parse(fs.readFileSync(REQUESTS_PATH, 'utf-8'));

        // Filtra per consulente
        const filterByConsultant = (items: any[]) =>
            items.filter((item: any) =>
                item.consultantId === consultantId || item.requesterId === consultantId
            );

        return NextResponse.json({
            riskReports: filterByConsultant(data.riskReports || []),
            transferRequests: filterByConsultant(data.transferRequests || []),
            discountRequests: filterByConsultant(data.discountRequests || []),
        });
    } catch (error) {
        console.error('Errore lettura richieste consulente:', error);
        return NextResponse.json({ error: 'Errore server' }, { status: 500 });
    }
}
