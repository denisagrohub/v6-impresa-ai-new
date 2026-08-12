import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'src/data/accounting-invoices.json');

// GET: Lista fatture con filtri (clientId, status)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');
        const status = searchParams.get('status');

        if (!fs.existsSync(DATA_PATH)) {
            return NextResponse.json({ invoices: [] });
        }

        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        let invoices = data.invoices || [];

        // Applica filtri
        if (clientId) {
            invoices = invoices.filter((i: any) => i.clientId === clientId);
        }
        if (status) {
            invoices = invoices.filter((i: any) => i.status === status);
        }

        return NextResponse.json({ invoices });
    } catch (error: any) {
        console.error('Errore lettura fatture:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Crea nuova fattura da SAL
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, salId, amount, issueDate, dueDate, status = 'pending', paymentLink, iban } = body;

        if (!clientId || !amount || !dueDate) {
            return NextResponse.json(
                { error: 'Campi obbligatori mancanti: clientId, amount, dueDate' },
                { status: 400 }
            );
        }

        const data = fs.existsSync(DATA_PATH)
            ? JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
            : { invoices: [] };

        const newInvoice = {
            id: `inv-${Date.now()}`,
            clientId,
            salId: salId || null,
            amount,
            issueDate: issueDate || new Date().toISOString().split('T')[0],
            dueDate,
            status,
            paymentLink: paymentLink || null,
            iban: iban || 'IT60X0542811101000000123456',
        };

        data.invoices.push(newInvoice);
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, invoice: newInvoice }, { status: 201 });
    } catch (error: any) {
        console.error('Errore creazione fattura:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Aggiorna stato fattura
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status) {
            return NextResponse.json(
                { error: 'Campi obbligatori mancanti: id, status' },
                { status: 400 }
            );
        }

        const validStatuses = ['draft', 'pending', 'paid', 'overdue'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Stato non valido. Usa uno di: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        if (!fs.existsSync(DATA_PATH)) {
            return NextResponse.json({ error: 'Nessuna fattura trovata' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        const invoiceIndex = data.invoices.findIndex((i: any) => i.id === id);

        if (invoiceIndex === -1) {
            return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
        }

        data.invoices[invoiceIndex].status = status;
        if (status === 'paid') {
            data.invoices[invoiceIndex].paidAt = new Date().toISOString();
        }

        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, invoice: data.invoices[invoiceIndex] });
    } catch (error: any) {
        console.error('Errore aggiornamento fattura:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
