const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Carica le variabili d'ambiente da .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Rimuovi eventuali virgolette
            process.env[key] = value;
        }
    });
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey() {
    const key = process.env.KB_ENCRYPTION_KEY;
    if (!key) throw new Error('KB_ENCRYPTION_KEY mancante in .env.local');
    return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

const plainDir = path.join(process.cwd(), 'src/data/kb/plain');
const encDir = path.join(process.cwd(), 'src/data/kb/encrypted');

if (!fs.existsSync(encDir)) fs.mkdirSync(encDir, { recursive: true });

const files = fs.readdirSync(plainDir).filter(f => f.endsWith('.json'));

console.log(`🔐 Cifratura di ${files.length} file KB...\n`);

for (const file of files) {
    const content = fs.readFileSync(path.join(plainDir, file), 'utf-8');
    const encrypted = encrypt(content);
    const outName = file.replace('.json', '.enc');
    fs.writeFileSync(path.join(encDir, outName), encrypted);
    console.log(`✅ ${file} → ${outName}`);
}

console.log(`\n🎯 ${files.length} file cifrati con successo.`);
console.log(`⚠️  Ricordati di NON committare la cartella plain/ su Git`);