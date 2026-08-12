import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ✅ FIX: Usa il percorso corretto per gli appuntamenti
const APPOINTMENTS_PATH = path.join(process.cwd(), 'src/data/appointments.json');

function ensureFile() {
    if (!fs.existsSync(APPOINTMENTS_PATH)) {
        fs.writeFileSync(APPOINTMENTS_PATH, JSON.stringify({ appointments: [] }, null, 2));
    }
}

function loadData() {
    ensureFile();
    return JSON.parse(fs.readFileSync(APPOINTMENTS_PATH, 'utf-8'));
}

function saveData(data: any) {
    fs.writeFileSync(APPOINTMENTS_PATH, JSON.stringify(data, null, 2));
}

// GET: lista appuntamenti (filtrati per progetto o consulente)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const consultantId = searchParams.get('consultantId');

        const data = loadData();
        let items = data.appointments || [];

        if (projectId) {
            items = items.filter((a: any) => a.projectId === projectId);
        }
        if (consultantId) {
            items = items.filter((a: any) => a.consultantId === consultantId);
        }

        // Ordina per data
        items.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return NextResponse.json({ appointments: items });
    } catch (error) {
        return NextResponse.json({ error: 'Errore lettura' }, { status: 500 });
    }
}

// POST: crea nuovo appuntamento
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = loadData();

        const newAppointment = {
            ...body,
            id: `APT-${Date.now()}`,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        data.appointments.push(newAppointment);
        saveData(data);

        console.log(`✅ Appuntamento creato: ${newAppointment.id}`);
        return NextResponse.json({ success: true, appointment: newAppointment });
    } catch (error) {
        return NextResponse.json({ error: 'Errore creazione' }, { status: 500 });
    }
}

// PUT: aggiorna appuntamento (es. completa, cancella)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const data = loadData();

        const index = data.appointments.findIndex((a: any) => a.id === body.id);
        if (index === -1) {
            return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
        }

        data.appointments[index] = {
            ...data.appointments[index],
            ...body,
            updatedAt: new Date().toISOString()
        };
        saveData(data);

        return NextResponse.json({ success: true, appointment: data.appointments[index] });
    } catch (error) {
        return NextResponse.json({ error: 'Errore aggiornamento' }, { status: 500 });
    }
}

// DELETE: rimuovi appuntamento
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        const data = loadData();
        data.appointments = data.appointments.filter((a: any) => a.id !== id);
        saveData(data);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
    }
}
