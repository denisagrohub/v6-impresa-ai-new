import crypto from 'crypto';

const SECRET_KEY = process.env.KB_SECRET_KEY || 'default-dev-secret-key-change-in-production';

export function encryptData(data: string): string {
    const key = Buffer.from(SECRET_KEY.padEnd(32, '0').substring(0, 32), 'utf8');
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decryptData(encryptedData: string): string {
    const key = Buffer.from(SECRET_KEY.padEnd(32, '0').substring(0, 32), 'utf8');
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

export function hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// ✅ Aggiunta funzione mancante
export function decryptJSON(encryptedData: string): any {
    try {
        const decrypted = decryptData(encryptedData);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Errore decrittazione JSON:', error);
        return null;
    }
}
