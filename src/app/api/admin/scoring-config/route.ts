import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '@/lib/auth';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/scoring-config.json');

function ensureConfigFile() {
    if (!fs.existsSync(CONFIG_PATH)) {
        const defaultConfig = {
            fatturatoAlto: 20, fatturatoMedio: 10, settoreHot: 10, importoOperazioneAlto: 10,
            ruoloDecisionale: 20, ruoloOperativo: 10, emailAziendale: 10,
            mandatoScritto: 20, mandatoVerbale: 5, partnerRicorrente: 10,
            sogliaWhale: 80, sogliaHot: 50,
            settoriHot: 'tech, finanza, energia, farmaceutico, aerospazio, biotech, fintech, sustainability, green',
            ruoliDecisionali: 'ceo, cfo, owner, fondatore, direttore generale, partner, amministratore, presidente',
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    }
}

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        ensureConfigFile();
        return NextResponse.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')));
    } catch (e) {
        return NextResponse.json({ error: 'Errore' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        ensureConfigFile();
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2));
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Errore' }, { status: 500 });
    }
}
