import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission, handleAuthError } from '@erpv6/auth';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');

function ensureConfigFile() {
    if (!fs.existsSync(CONFIG_PATH)) {
        const defaultConfig = {
            useOdoo: false,
            odooUrl: '',
            odooDb: '',
            odooApiKey: '',
            activeBrand: 'progetto-impresa',
            whitelabelEnabled: false,
            deploy: {
                vpsHost: '',
                vpsUser: 'root',
                vpsSshPort: 22,
                vpsSshKeyPath: '~/.ssh/id_rsa',
                odooAddonsPath: '/opt/odoo/custom_addons',
                odooService: 'odoo',
                odooUser: 'odoo'
            },
            callAI: {
                dailyApiKey: '',
                deepgramApiKey: '',
                anthropicApiKey: '',
                groqApiKey: '',
                aiProvider: 'claude',
                enabled: false
            }
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    }
}

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }
        ensureConfigFile();
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(fileContent);
        return NextResponse.json(config);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }
        const body = await request.json();
        ensureConfigFile();

        if (body.useOdoo && (!body.odooUrl || !body.odooDb)) {
            return NextResponse.json(
                { error: 'URL e Database sono obbligatori se Odoo è attivo' },
                { status: 400 }
            );
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleAuthError(error);
    }
}
