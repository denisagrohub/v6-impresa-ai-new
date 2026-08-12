import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CALENDAR_PATH = path.join(process.cwd(), 'src/data/consultant-calendar.json');

function ensureFile() {
    if (!fs.existsSync(CALENDAR_PATH)) {
        const defaultData = {
            events: [],
            settings: {
                maxDailyPublicSlots: 3,
                defaultDuration: 60,
                workingHours: {
                    start: "09:00",
                    end: "18:00",
                    days: [1, 2, 3, 4, 5]
                },
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

// GET: Lista slot pubblici disponibili
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const consultantId = searchParams.get('consultantId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const data = loadData();
        let publicSlots = data.events.filter((e: any) => e.isPublic && e.status === 'scheduled');

        // Filtri
        if (consultantId) {
            publicSlots = publicSlots.filter((e: any) => e.consultantId === consultantId);
        }
        if (startDate && endDate) {
            publicSlots = publicSlots.filter((e: any) => {
                const eventDate = new Date(e.date);
                return eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
            });
        }

        // Solo slot futuri
        publicSlots = publicSlots.filter((e: any) => new Date(e.date) >= new Date());

        // Ordina per data
        publicSlots.sort((a: any, b: any) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA.getTime() - dateB.getTime();
        });

        return NextResponse.json({ slots: publicSlots });
    } catch (error) {
        console.error('Errore lettura slot pubblici:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}

// POST: Pubblica nuovo slot
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = loadData();

        // Verifica limite giornaliero
        const todaySlots = data.events.filter((e: any) =>
            e.isPublic &&
            e.consultantId === body.consultantId &&
            e.date === body.date &&
            e.status === 'scheduled'
        );

        if (todaySlots.length >= (data.settings.maxDailyPublicSlots || 3)) {
            return NextResponse.json(
                { error: `Limite giornaliero raggiunto (max ${data.settings.maxDailyPublicSlots} slot/giorno)` },
                { status: 400 }
            );
        }

        // Genera token univoco per booking
        const bookingToken = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newSlot = {
            id: `PUB-${Date.now()}`,
            ...body,
            isPublic: true,
            bookingToken,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        data.events.push(newSlot);
        saveData(data);

        console.log(`✅ Slot pubblico creato: ${newSlot.id} | Token: ${bookingToken}`);
        return NextResponse.json({ success: true, slot: newSlot });
    } catch (error) {
        console.error('Errore creazione slot pubblico:', error);
        return NextResponse.json({ error: 'Errore creazione' }, { status: 500 });
    }
}

// DELETE: Rimuovi slot pubblico
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        const data = loadData();
        const index = data.events.findIndex((e: any) => e.id === id);

        if (index === -1) {
            return NextResponse.json({ error: 'Slot non trovato' }, { status: 404 });
        }

        // Verifica che sia uno slot pubblico
        if (!data.events[index].isPublic) {
            return NextResponse.json({ error: 'Non è uno slot pubblico' }, { status: 400 });
        }

        data.events.splice(index, 1);
        saveData(data);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Errore eliminazione slot:', error);
        return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
    }
}
