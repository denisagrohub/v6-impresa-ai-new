import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '@erpv6/auth';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/pricing-config.json');

function ensureConfigFile() {
    if (!fs.existsSync(CONFIG_PATH)) {
        const defaultConfig = {
            base: 50000,
            pesoImporto: 0.015,
            pesoComplessita: 25000,
            pesoUrgenza: 1.25,
            settoriComplessi: ['m&a', 'ristrutturazione debito', 'acquisizione', 'fusione', 'ipo'],
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
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(fileContent);
        return NextResponse.json(config);
    } catch (error) {
        return NextResponse.json({ error: 'Errore lettura config' }, { status: 500 });
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
    } catch (error) {
        return NextResponse.json({ error: 'Errore salvataggio config' }, { status: 500 });
    }
}
