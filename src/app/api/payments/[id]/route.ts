import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const INVOICES_PATH = path.join(process.cwd(), 'src/data/invoices.json');

function ensureInvoicesFile() {
    const dir = path.dirname(INVOICES_PATH);
    // Crea la cartella src/data se non esiste
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Crea il file con dati demo se non esiste
    if (!fs.existsSync(INVOICES_PATH)) {
        const defaultData = {
            invoices: [
                {
                    id: "INV-DEMO-001",
                    clientId: "client_001",
                    clientName: "Mario Rossi",
                    clientEmail: "demo@progettoimpresa.it",
                    projectCode: "PI-2026-0024",
                    level: "L3",
                    amount: 22500,
                    currency: "EUR",
                    description: "SAL 2 - Consegna Audit Report (Fase 1)",
                    status: "pending",
                    paymentMethod: null,
                    paymentLink: "/checkout/INV-DEMO-001",
                    iban: "IT60 X030 6903 2000 CB00 0000 0000",
                    createdAt: "2026-07-01T10:00:00.000Z",
                    dueDate: "2026-07-30T23:59:59.000Z",
                    salNumber: 2,
                    demo: true
                }
            ]
        };
        fs.writeFileSync(INVOICES_PATH, JSON.stringify(defaultData, null, 2));
    }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        ensureInvoicesFile();

        const fileContent = fs.readFileSync(INVOICES_PATH, 'utf-8');
        const data = JSON.parse(fileContent);

        const invoice = data.invoices.find((inv: any) => inv.id === params.id);

        if (!invoice) {
            return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
        }

        return NextResponse.json(invoice);
    } catch (error) {
        console.error('ERRORE LETTURA FATTURA:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        ensureInvoicesFile();

        const { status, paymentMethod } = await request.json();
        const fileContent = fs.readFileSync(INVOICES_PATH, 'utf-8');
        const data = JSON.parse(fileContent);

        const index = data.invoices.findIndex((inv: any) => inv.id === params.id);

        if (index === -1) {
            return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
        }

        // Aggiorna i dati
        data.invoices[index].status = status;
        data.invoices[index].updatedAt = new Date().toISOString();

        if (status === 'paid') {
            data.invoices[index].paidAt = new Date().toISOString();
            data.invoices[index].paymentMethod = paymentMethod || 'stripe';
        }

        // Salva su file
        fs.writeFileSync(INVOICES_PATH, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, message: 'Pagamento registrato' });
    } catch (error) {
        console.error('ERRORE AGGIORNAMENTO FATTURA:', error);
        return NextResponse.json({ error: 'Errore durante il salvataggio' }, { status: 500 });
    }
}
