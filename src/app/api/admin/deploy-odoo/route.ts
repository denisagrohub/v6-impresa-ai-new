import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { requirePermission, handleAuthError } from '@/lib/auth';

const execAsync = promisify(exec);
const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');
const MODULES_DIR = path.join(process.cwd(), 'odoo-modules');

export async function GET(request: NextRequest) {
    try {
        requirePermission(request, ['settings.configure_deploy']);

        if (!fs.existsSync(MODULES_DIR)) {
            return NextResponse.json({ modules: [] });
        }

        const modules = fs.readdirSync(MODULES_DIR)
            .filter(f => fs.statSync(path.join(MODULES_DIR, f)).isDirectory())
            .map(name => {
                const manifestPath = path.join(MODULES_DIR, name, '__manifest__.py');
                let version = 'unknown';
                if (fs.existsSync(manifestPath)) {
                    const content = fs.readFileSync(manifestPath, 'utf-8');
                    const match = content.match(/'version':\s*'([^']+)'/);
                    if (match) version = match[1];
                }
                return { name, version };
            });

        return NextResponse.json({ modules });
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        requirePermission(request, ['admin.deploy_odoo']);

        const { action, config, modules } = await request.json();

        if (!config || !config.vpsHost) {
            return NextResponse.json(
                { success: false, error: 'Configurazione VPS mancante', log: [] },
                { status: 400 }
            );
        }

        let sshCmd = 'ssh';
        if (config.vpsSshKeyPath) {
            sshCmd += ` -i ${config.vpsSshKeyPath}`;
        }
        if (config.vpsSshPort && config.vpsSshPort !== 22) {
            sshCmd += ` -p ${config.vpsSshPort}`;
        }
        sshCmd += ` -o ConnectTimeout=10 -o StrictHostKeyChecking=no`;
        sshCmd += ` ${config.vpsUser}@${config.vpsHost}`;

        if (action === 'test') {
            try {
                const { stdout } = await execAsync(`${sshCmd} "echo 'SSH_OK'"`);
                return NextResponse.json({
                    success: stdout.includes('SSH_OK'),
                    log: ['✅ Connessione SSH riuscita!']
                });
            } catch (error: any) {
                return NextResponse.json({
                    success: false,
                    log: ['❌ Connessione SSH fallita!', error.message]
                });
            }
        }

        if (action === 'deploy') {
            const log: string[] = [];

            if (!fs.existsSync(MODULES_DIR)) {
                return NextResponse.json({
                    success: false,
                    log: ['❌ Cartella odoo-modules non trovata']
                });
            }

            let modulesToDeploy: string[] = [];
            if (modules && modules.length > 0) {
                modulesToDeploy = modules;
            } else {
                modulesToDeploy = fs.readdirSync(MODULES_DIR)
                    .filter(f => fs.statSync(path.join(MODULES_DIR, f)).isDirectory());
            }

            log.push(`📦 Moduli da deployare: ${modulesToDeploy.join(', ')}`);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupDir = `/tmp/odoo-backup-${timestamp}`;

            try {
                await execAsync(`${sshCmd} "sudo mkdir -p ${backupDir} && sudo cp -r ${config.odooAddonsPath}/* ${backupDir}/ 2>/dev/null || true"`);
                log.push(`💾 Backup creato: ${backupDir}`);
            } catch (error: any) {
                log.push(`⚠️ Backup fallito (continuo comunque): ${error.message}`);
            }

            for (const moduleName of modulesToDeploy) {
                const modulePath = path.join(MODULES_DIR, moduleName);
                if (!fs.existsSync(path.join(modulePath, '__manifest__.py'))) {
                    log.push(`❌ ${moduleName}: __manifest__.py mancante, skip`);
                    continue;
                }

                log.push(`📤 Deploy ${moduleName}...`);

                try {
                    await execAsync(`${sshCmd} "sudo rm -rf ${config.odooAddonsPath}/${moduleName}"`);
                } catch (error: any) {
                    log.push(`⚠️ Rimozione vecchia versione fallita: ${error.message}`);
                }

                const scpCmd = config.vpsSshKeyPath
                    ? `scp -i ${config.vpsSshKeyPath}${config.vpsSshPort !== 22 ? ` -P ${config.vpsSshPort}` : ''}`
                    : `scp${config.vpsSshPort !== 22 ? ` -P ${config.vpsSshPort}` : ''}`;

                try {
                    await execAsync(`${scpCmd} -r "${modulePath}" ${config.vpsUser}@${config.vpsHost}:/tmp/`);
                    await execAsync(`${sshCmd} "sudo mv /tmp/${moduleName} ${config.odooAddonsPath}/ && sudo chown -R ${config.odooUser}:${config.odooUser} ${config.odooAddonsPath}/${moduleName}"`);
                    log.push(`✅ ${moduleName} deployato`);
                } catch (error: any) {
                    log.push(`❌ ${moduleName} deploy fallito: ${error.message}`);
                }
            }

            log.push(`🔄 Restart servizio ${config.odooService}...`);
            try {
                await execAsync(`${sshCmd} "sudo systemctl restart ${config.odooService}"`);
                log.push(`✅ Servizio riavviato`);
            } catch (error: any) {
                log.push(`❌ Restart fallito: ${error.message}`);
            }

            log.push(`✅ Deploy completato!`);
            return NextResponse.json({ success: true, log });
        }

        return NextResponse.json(
            { success: false, error: 'Azione non valida', log: [] },
            { status: 400 }
        );
    } catch (error) {
        return handleAuthError(error);
    }
}
