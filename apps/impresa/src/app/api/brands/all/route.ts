import { NextResponse } from 'next/server';
import localDb from '@/data/local-db.json';

// Definiamo il tipo localmente per sbloccare il build
type BrandData = {
    [key: string]: any;
};

export async function GET() {
    try {
        // Converte l'oggetto brands in array
        const brandsArray = Object.values(localDb.brands as Record<string, BrandData>);

        return NextResponse.json(brandsArray, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate',
            },
        });
    } catch (error) {
        console.error('Errore API brands/all:', error);
        return NextResponse.json(
            { error: 'Errore interno del server' },
            { status: 500 }
        );
    }
}