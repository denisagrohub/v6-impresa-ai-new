import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission, handleAuthError } from '@erpv6/auth';

const MOCK_PATH = path.join(process.cwd(), 'src/data/consultant-mock.json');
const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function GET(request: NextRequest) {
    try {
        const user = requirePermission(request, ['consultant.view_own_dashboard']);

        if (!fs.existsSync(MOCK_PATH)) {
            return NextResponse.json({ error: 'Dati consulente non trovati' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(MOCK_PATH, 'utf-8'));

        // Verifica che il consulente stia vedendo solo i propri dati
        if (data.consultant.id !== user.id && user.role !== 'admin' && user.role !== 'chief') {
            return NextResponse.json(
                { error: 'Non hai accesso a questi dati' },
                { status: 403 }
            );
        }

        if (fs.existsSync(PARTNERS_PATH)) {
            const partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
            const partner = partnersData.partners.find((p: any) => p.id === data.consultant.id);
            if (partner && partner.hourlyRate) {
                data.consultant.hourlyRate = partner.hourlyRate;
                data.consultant.partnerId = partner.id;
                data.consultant.commissionRate = partner.commissionRate;
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        return handleAuthError(error);
    }
}
