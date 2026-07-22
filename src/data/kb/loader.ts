import fs from 'fs';
import path from 'path';
import { decryptJSON } from '@/lib/kb-crypto';
import { canAccessKB, type UserRole } from './access-control';

const PLAIN_DIR = path.join(process.cwd(), 'src/data/kb/plain');
const ENC_DIR = path.join(process.cwd(), 'src/data/kb/encrypted');

export function loadKB(module: string): any {
    // In dev, prova prima il file in chiaro
    if (process.env.KB_ENCRYPTION_ENABLED === 'false' || process.env.NODE_ENV === 'development') {
        const plainPath = path.join(PLAIN_DIR, `${module}.json`);
        if (fs.existsSync(plainPath)) {
            return JSON.parse(fs.readFileSync(plainPath, 'utf-8'));
        }
    }
    // Altrimenti carica il file cifrato
    const encPath = path.join(ENC_DIR, `${module}.enc`);
    if (fs.existsSync(encPath)) {
        return decryptJSON(fs.readFileSync(encPath, 'utf-8'));
    }
    throw new Error(`KB non trovata: ${module}`);
}

export function loadKBWithAccess(module: string, role: UserRole): any {
    if (!canAccessKB(role, module)) {
        throw new Error(`Accesso negato: ${module} per ruolo ${role}`);
    }
    return loadKB(module);
}
