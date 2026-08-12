import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CALENDAR_PATH = path.join(process.cwd(), 'src/data/consultant-calendar.json');
const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

function ensureFile() {
    if (!fs.existsSync(CALENDAR_PATH)) {
        fs.writeFileSync(CALENDAR_PATH, JSON.stringify({ events: [], settings: {} }, null, 2));
    }
}

function loadData() {
    ensureFile();
    return JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf-8'));
}

// GET: Disponibilità team (solo busy/free, no dettagli)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const consultantId = searchParams.get('consultantId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const brand = searchParams.get('brand');

        // Carica tutti i partner consulenti
        let partners: any[] = [];
        if (fs.existsSync(PARTNERS_PATH)) {
            const partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
            partners = partnersData.partners.filter((p: any) => p.type === 'consultant');

            // Filtra per brand se specificato
            if (brand) {
                partners = partners.filter((p: any) => p.brand === brand || !p.brand);
            }
        }

        // Carica eventi
        const data = loadData();
        const events = data.events || [];

        // Per ogni consulente, calcola slot occupati
        const availability = partners.map((partner) => {
            const consultantEvents = events.filter((e: any) =>
                e.consultantId === partner.id &&
                e.status === 'scheduled'
            );

            // Filtra per range date
            let filteredEvents = consultantEvents;
            if (startDate && endDate) {
                filteredEvents = consultantEvents.filter((e: any) => {
                    const eventDate = new Date(e.date);
                    return eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
                });
            }

            // Crea lista di slot occupati (solo data, ora, durata - NO titolo/cliente)
            const busySlots = filteredEvents.map((e: any) => ({
                date: e.date,
                time: e.time,
                duration: e.duration,
                type: e.type // discovery, review, call, public
            }));

            return {
                consultantId: partner.id,
                consultantName: partner.name,
                consultantEmail: partner.email,
                busySlots,
                totalBusySlots: busySlots.length
            };
        });

        return NextResponse.json({ availability });
    } catch (error) {
        console.error('Errore lettura disponibilità team:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
