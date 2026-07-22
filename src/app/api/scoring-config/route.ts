import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEFAULT_SCORING_CONFIG } from '@/lib/lead-scoring';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/scoring-config.json');

export async function GET() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            return NextResponse.json(config);
        }
    } catch (e) {
        console.error('Errore lettura config scoring:', e);
    }

    // Fallback: ritorna la config di default
    return NextResponse.json(DEFAULT_SCORING_CONFIG);
}
