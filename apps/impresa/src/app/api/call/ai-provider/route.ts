import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission, handleAuthError } from '@erpv6/auth';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');

export async function GET(request: NextRequest) {
    try {
        // Admin può vedere tutti i provider, consultant solo quello attivo
        const permissionCheck = requirePermission(request, ['admin', 'chief', 'consultant']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }
        const user = permissionCheck;

        if (!fs.existsSync(CONFIG_PATH)) {
            return NextResponse.json({ provider: 'claude' });
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

        // Se è admin/chief, mostra tutti i provider disponibili
        if (user.role === 'admin' || user.role === 'chief') {
            return NextResponse.json({
                provider: config.callAI?.aiProvider || 'claude',
                availableProviders: ['claude', 'groq']
            });
        }

        // Se è consultant, mostra solo il provider attivo
        return NextResponse.json({
            provider: config.callAI?.aiProvider || 'claude'
        });
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        // Solo admin/chief possono cambiare provider
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { provider } = await request.json();

        if (!['claude', 'groq'].includes(provider)) {
            return NextResponse.json({ error: 'Provider non valido' }, { status: 400 });
        }

        if (!fs.existsSync(CONFIG_PATH)) {
            return NextResponse.json({ error: 'Config non trovata' }, { status: 404 });
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        config.callAI = config.callAI || {};
        config.callAI.aiProvider = provider;

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        return NextResponse.json({
            success: true,
            provider,
            message: `Provider AI cambiato a: ${provider}`
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
