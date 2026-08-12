import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');

export async function readData<T>(filename: string): Promise<T | null> {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (fs.existsSync(filePath)) {
            const fileContents = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(fileContents) as T;
        }
        return null;
    } catch (error) {
        console.error(`Errore lettura file dati ${filename}:`, error);
        return null;
    }
}

export async function writeData<T>(filename: string, data: T): Promise<boolean> {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Errore scrittura file dati ${filename}:`, error);
        return false;
    }
}

export async function updateData<T>(filename: string, updateFn: (data: T | null) => T): Promise<boolean> {
    const currentData = await readData<T>(filename);
    const newData = updateFn(currentData);
    return writeData(filename, newData);
}

// ✅ Aggiunta funzione mancante
export async function getBrandData(brandSlug: string): Promise<any> {
    const brands = await readData<any[]>('brands.json');
    return brands?.find(b => b.id === brandSlug || b.slug === brandSlug) || null;
}
