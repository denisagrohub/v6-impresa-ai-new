import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CALENDAR_PATH = path.join(process.cwd(), 'src/data/consultant-calendar.json');

function ensureFile() {
    if (!fs.existsSync(CALENDAR_PATH)) {
        fs.writeFileSync(CALENDAR_PATH, JSON.stringify({ events: [], settings: {} }, null, 2));
    }
}

function loadData() {
    ensureFile();
    return JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf-8'));
}

function saveData(data: any) {
    fs.writeFileSync(CALENDAR_PATH, JSON.stringify(data, null, 2));
}

// POST: Crea evento calendario per Call AI
export async function POST(request: NextRequest) {
    try {
        const { projectId, projectName, clientName, consultantId, consultantName, date, time, duration = 60 } = await request.json();

        const data = loadData();

        // Crea evento calendario
        const newEvent = {
            id: `CAL-AI-${Date.now()}`,
            title: `🎙️ Call AI - ${projectName}`,
            description: `Call AI con ${clientName}\nProgetto: ${projectName}\nTipo: Call AI con trascrizione e analisi pattern`,
            date,
            time,
            duration,
            type: 'call-ai',
            projectId,
            projectName,
            clientName,
            consultantId,
            consultantName,
            brand: 'progetto-impresa',
            status: 'scheduled',
            isPublic: false,
            createdAt: new Date().toISOString()
        };

        data.events.push(newEvent);
        saveData(data);

        console.log(`✅ Evento Call AI creato nel calendario: ${newEvent.id}`);

        return NextResponse.json({
            success: true,
            event: newEvent,
            message: 'Call AI pianificata nel calendario'
        });

    } catch (error) {
        console.error('Errore creazione evento Call AI:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
