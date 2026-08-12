import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'src/data/accounting-sals.json');

// GET: Lista SAL con filtri (projectId, status)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const status = searchParams.get('status');

        if (!fs.existsSync(DATA_PATH)) {
            return NextResponse.json({ sals: [] });
        }

        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        let sals = data.sals || [];

        // Applica filtri
        if (projectId) {
            sals = sals.filter((s: any) => s.projectId === projectId);
        }
        if (status) {
            sals = sals.filter((s: any) => s.status === status);
        }

        return NextResponse.json({ sals });
    } catch (error: any) {
        console.error('Errore lettura SAL:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Crea nuovo SAL
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, description, amount, dueDate, status = 'draft' } = body;

        if (!projectId || !description || !amount || !dueDate) {
            return NextResponse.json(
                { error: 'Campi obbligatori mancanti: projectId, description, amount, dueDate' },
                { status: 400 }
            );
        }

        const data = fs.existsSync(DATA_PATH)
            ? JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
            : { sals: [] };

        const newSal = {
            id: `sal-${Date.now()}`,
            projectId,
            description,
            amount,
            dueDate,
            status,
            issueDate: null,
        };

        data.sals.push(newSal);
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, sal: newSal }, { status: 201 });
    } catch (error: any) {
        console.error('Errore creazione SAL:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
