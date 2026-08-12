import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DRAFTS_PATH = path.join(process.cwd(), 'src/data/drafts.json');

function ensureDraftsFile() {
    if (!fs.existsSync(DRAFTS_PATH)) {
        fs.writeFileSync(DRAFTS_PATH, JSON.stringify({ drafts: [] }, null, 2));
    }
}

function loadDrafts() {
    ensureDraftsFile();
    return JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf-8'));
}

function saveDrafts(data: any) {
    fs.writeFileSync(DRAFTS_PATH, JSON.stringify(data, null, 2));
}

// GET: Lista draft abbandonati
export async function GET() {
    const data = loadDrafts();
    const now = Date.now();
    const dueOre = 2 * 60 * 60 * 1000;
    const ventiquattroOre = 24 * 60 * 60 * 1000;
    const treGiorni = 3 * 24 * 60 * 60 * 1000;

    const daRecuperare = data.drafts.filter((d: any) => {
        if (d.status === 'completato' || d.status === 'archiviato') return false;
        const tempoPassato = now - new Date(d.lastModified).getTime();
        return tempoPassato >= dueOre;
    }).map((d: any) => {
        const tempoPassato = now - new Date(d.lastModified).getTime();
        let emailDaInviare = null;
        if (tempoPassato >= treGiorni && !d.email3Sent) emailDaInviare = 3;
        else if (tempoPassato >= ventiquattroOre && !d.email2Sent) emailDaInviare = 2;
        else if (tempoPassato >= dueOre && !d.email1Sent) emailDaInviare = 1;
        return { ...d, emailDaInviare };
    });

    return NextResponse.json({ drafts: daRecuperare });
}

// POST: Salva/aggiorna un draft
export async function POST(request: Request) {
    const body = await request.json();
    const data = loadDrafts();

    const existingIndex = data.drafts.findIndex((d: any) => d.id === body.id);

    const draft = {
        id: body.id || `draft_${Date.now()}`,
        level: body.level,
        formData: body.formData,
        tipoRichiedente: body.tipoRichiedente,
        leadScore: body.leadScore,
        status: body.status || 'abbandonato',
        lastModified: new Date().toISOString(),
        email1Sent: body.email1Sent || false,
        email2Sent: body.email2Sent || false,
        email3Sent: body.email3Sent || false,
    };

    if (existingIndex >= 0) {
        data.drafts[existingIndex] = draft;
    } else {
        data.drafts.push(draft);
    }

    saveDrafts(data);
    return NextResponse.json({ success: true, id: draft.id });
}

// PUT: Invia email di recupero (simulata per ora)
export async function PUT(request: Request) {
    const { draftId, emailNumber } = await request.json();
    const data = loadDrafts();
    const draft = data.drafts.find((d: any) => d.id === draftId);

    if (!draft) {
        return NextResponse.json({ error: 'Draft non trovato' }, { status: 404 });
    }

    // Simulazione invio email
    console.log(` EMAIL ${emailNumber} INVIATA A ${draft.formData.email}:`);
    if (emailNumber === 1) {
        console.log(`Oggetto: "Hai bisogno di aiuto con la configurazione del tuo progetto?"`);
        draft.email1Sent = true;
    } else if (emailNumber === 2) {
        console.log(`Oggetto: "3 errori da evitare nel tuo ${draft.level}"`);
        draft.email2Sent = true;
    } else if (emailNumber === 3) {
        console.log(`Oggetto: "Stiamo per archiviare la tua bozza"`);
        draft.email3Sent = true;
        draft.status = 'archiviato';
    }

    saveDrafts(data);
    return NextResponse.json({ success: true, sent: emailNumber });
}
