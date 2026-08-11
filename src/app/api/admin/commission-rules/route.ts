import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '@/lib/auth';

const RULES_PATH = path.join(process.cwd(), 'src/data/commission-rules.json');

function ensureFile() {
    if (!fs.existsSync(RULES_PATH)) {
        const defaultRules = {
            rules: {
                L1: { nome: "Pacchetto Startup", prezzoBase: 1500, tipoProvvigioneConsulente: "fisso", valoreConsulente: 500, percentualeReferral: 10, costiFissiAzienda: 100 },
                L2: { nome: "Piano Industriale", prezzoBase: 20000, tipoProvvigioneConsulente: "percentuale", valoreConsulente: 30, percentualeReferral: 10, costiFissiAzienda: 500 },
                L3: { nome: "Advisory Strategico", prezzoBase: 50000, tipoProvvigioneConsulente: "percentuale", valoreConsulente: 35, percentualeReferral: 15, costiFissiAzienda: 1000 }
            }
        };
        fs.writeFileSync(RULES_PATH, JSON.stringify(defaultRules, null, 2));
    }
}

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        ensureFile();
        const data = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Errore lettura regole' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        ensureFile();
        fs.writeFileSync(RULES_PATH, JSON.stringify(body, null, 2));
        return NextResponse.json({ success: true, message: 'Regole aggiornate' });
    } catch (error) {
        return NextResponse.json({ error: 'Errore salvataggio' }, { status: 500 });
    }
}
