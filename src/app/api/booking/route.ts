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

// POST: Prenota slot pubblico
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { bookingToken, clientName, clientEmail, clientPhone, notes } = body;

        if (!bookingToken || !clientName || !clientEmail) {
            return NextResponse.json(
                { error: 'Token e dati cliente obbligatori' },
                { status: 400 }
            );
        }

        const data = loadData();
        const slotIndex = data.events.findIndex((e: any) => e.bookingToken === bookingToken);

        if (slotIndex === -1) {
            return NextResponse.json({ error: 'Slot non trovato o non più disponibile' }, { status: 404 });
        }

        const slot = data.events[slotIndex];

        // Verifica che lo slot sia ancora disponibile
        if (slot.status !== 'scheduled') {
            return NextResponse.json({ error: 'Slot già prenotato' }, { status: 400 });
        }

        // Aggiorna lo slot con i dati del cliente
        data.events[slotIndex] = {
            ...slot,
            status: 'booked',
            clientName,
            clientEmail,
            clientPhone,
            notes,
            bookedAt: new Date().toISOString()
        };

        saveData(data);

        console.log(`✅ Slot prenotato: ${slot.id} | Cliente: ${clientName}`);

        // In produzione: invia email di conferma al cliente e al consulente
        // await sendBookingConfirmationEmail(slot, clientEmail);

        return NextResponse.json({
            success: true,
            booking: {
                id: slot.id,
                date: slot.date,
                time: slot.time,
                duration: slot.duration,
                consultantName: slot.consultantName,
                clientName,
                clientEmail
            }
        });
    } catch (error) {
        console.error('Errore prenotazione slot:', error);
        return NextResponse.json({ error: 'Errore prenotazione' }, { status: 500 });
    }
}
