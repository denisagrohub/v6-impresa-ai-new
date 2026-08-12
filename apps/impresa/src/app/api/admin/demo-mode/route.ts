import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDemoStats, clearDemoData } from '@/lib/payment-adapter';
import { requirePermission } from '@erpv6/auth';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        const stats = getDemoStats();

        return NextResponse.json({
            demoMode: config.demoMode !== false,
            stats,
        });
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

        const { demoMode, adminPassword } = await request.json();

        // Verifica password admin (semplice per ora, in produzione: bcrypt)
        if (adminPassword !== 'admin123') {
            return NextResponse.json(
                { error: 'Password admin non valida' },
                { status: 401 }
            );
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        const wasDemo = config.demoMode !== false;
        const willBeDemo = demoMode;

        // Se stiamo passando da DEMO → PRODUZIONE, cancella dati demo
        let deletedData = null;
        if (wasDemo && !willBeDemo) {
            deletedData = clearDemoData();
            console.log(`🧹 Dati demo cancellati:`, deletedData);
        }

        config.demoMode = willBeDemo;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        return NextResponse.json({
            success: true,
            demoMode: willBeDemo,
            deletedData,
            message: wasDemo && !willBeDemo
                ? '✅ Modalità Produzione attivata. Dati demo cancellati.'
                : willBeDemo
                    ? '🧪 Modalità Demo attivata.'
                    : '✅ Configurazione aggiornata.'
        });
    } catch (error) {
        console.error('Errore cambio modalità:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
