import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBrandData } from '@/lib/data-adapter';

const LOCAL_DB_PATH = path.join(process.cwd(), 'src/data/local-db.json');

// GET: Leggi un brand specifico
export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const brand = await getBrandData(params.slug);
        if (!brand) {
            return NextResponse.json({ error: 'Brand non trovato' }, { status: 404 });
        }
        return NextResponse.json(brand);
    } catch (error) {
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
    }
}

// PUT: Aggiorna un brand
export async function PUT(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const updatedData = await request.json();

        // Leggi il file JSON attuale
        const fileContent = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        const localDb = JSON.parse(fileContent);

        // Verifica che il brand esista
        if (!localDb.brands[slug]) {
            return NextResponse.json({ error: 'Brand non trovato' }, { status: 404 });
        }

        // Aggiorna il brand mantenendo l'id
        localDb.brands[slug] = {
            ...localDb.brands[slug],
            ...updatedData,
            id: slug, // Mantieni l'id originale
        };

        // Salva il file
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDb, null, 2));

        return NextResponse.json({ success: true, brand: localDb.brands[slug] });
    } catch (error) {
        console.error('Errore update brand:', error);
        return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 });
    }
}
