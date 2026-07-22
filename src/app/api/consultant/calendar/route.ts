import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ✅ FIX: Usa il file corretto
const CALENDAR_PATH = path.join(process.cwd(), 'src/data/consultant-calendar.json');

function ensureFile() {
    if (!fs.existsSync(CALENDAR_PATH)) {
        const defaultData = {
            events: [],
            settings: {
                maxDailyPublicSlots: 3,
                defaultDuration: 60,
                workingHours: { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
                googleCalendarSync: false,
                googleCalendarId: null
            }
        };
        fs.writeFileSync(CALENDAR_PATH, JSON.stringify(defaultData, null, 2));
    }
}

function loadData() {
    ensureFile();
    return JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf-8'));
}

function saveData(data: any) {
    fs.writeFileSync(CALENDAR_PATH, JSON.stringify(data, null, 2));
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const consultantId = searchParams.get('consultantId');
        const projectId = searchParams.get('projectId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const type = searchParams.get('type');

        const data = loadData();
        let events = data.events || [];

        if (consultantId) events = events.filter((e: any) => e.consultantId === consultantId);
        if (projectId) events = events.filter((e: any) => e.projectId === projectId);
        if (type) events = events.filter((e: any) => e.type === type);
        if (startDate && endDate) {
            events = events.filter((e: any) => {
                const eventDate = new Date(e.date);
                return eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
            });
        }

        events.sort((a: any, b: any) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA.getTime() - dateB.getTime();
        });

        return NextResponse.json({
            events,
            settings: data.settings,
            stats: {
                total: events.length,
                upcoming: events.filter((e: any) => new Date(e.date) >= new Date()).length,
                completed: events.filter((e: any) => e.status === 'completed').length,
                publicSlots: events.filter((e: any) => e.isPublic).length
            }
        });
    } catch (error) {
        console.error('Errore lettura calendario:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = loadData();
        const newEvent = {
            id: `CAL-${Date.now()}`,
            ...body,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };
        data.events.push(newEvent);
        saveData(data);
        return NextResponse.json({ success: true, event: newEvent });
    } catch (error) {
        return NextResponse.json({ error: 'Errore creazione' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const data = loadData();
        const index = data.events.findIndex((e: any) => e.id === body.id);
        if (index === -1) return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        data.events[index] = { ...data.events[index], ...body, updatedAt: new Date().toISOString() };
        saveData(data);
        return NextResponse.json({ success: true, event: data.events[index] });
    } catch (error) {
        return NextResponse.json({ error: 'Errore aggiornamento' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const data = loadData();
        data.events = data.events.filter((e: any) => e.id !== id);
        saveData(data);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
    }
}
