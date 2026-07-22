import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const formData = await request.formData();
        const file = formData.get('logo') as File;
        const type = formData.get('type') as string; // 'logo' | 'favicon' | 'og-image'

        if (!file) {
            return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 });
        }

        // Validazione tipo file
        const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Tipo file non supportato' }, { status: 400 });
        }

        // Validazione dimensione (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File troppo grande (max 5MB)' }, { status: 400 });
        }

        // Crea la cartella del brand se non esiste
        const brandDir = path.join(process.cwd(), 'public', 'brands', slug);
        if (!fs.existsSync(brandDir)) {
            fs.mkdirSync(brandDir, { recursive: true });
        }

        // Salva il file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `${type}.${file.name.split('.').pop()}`;
        const filePath = path.join(brandDir, fileName);

        await writeFile(filePath, buffer);

        // Aggiorna il JSON del brand
        const brandJsonPath = path.join(process.cwd(), 'src', 'data', 'local-db.json');
        const brandJson = JSON.parse(fs.readFileSync(brandJsonPath, 'utf-8'));

        if (brandJson.brands[slug]) {
            if (!brandJson.brands[slug].assets) {
                brandJson.brands[slug].assets = {};
            }
            brandJson.brands[slug].assets[type] = `/brands/${slug}/${fileName}`;
            fs.writeFileSync(brandJsonPath, JSON.stringify(brandJson, null, 2));
        }

        return NextResponse.json({
            success: true,
            url: `/brands/${slug}/${fileName}`,
            message: 'File caricato con successo'
        });
    } catch (error) {
        console.error('Errore upload:', error);
        return NextResponse.json({ error: 'Errore durante il caricamento' }, { status: 500 });
    }
}
