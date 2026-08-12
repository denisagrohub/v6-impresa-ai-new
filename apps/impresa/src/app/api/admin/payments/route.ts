import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '@erpv6/auth';

const INVOICES_PATH = path.join(process.cwd(), 'src/data/invoices.json');

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');
        const status = searchParams.get('status');
        const demo = searchParams.get('demo');

        if (!fs.existsSync(INVOICES_PATH)) {
            return NextResponse.json({ invoices: [], stats: {} });
        }

        const data = JSON.parse(fs.readFileSync(INVOICES_PATH, 'utf-8'));
        let invoices = data.invoices || [];

        // Filtri
        if (clientId) invoices = invoices.filter((inv: any) => inv.clientId === clientId);
        if (status) invoices = invoices.filter((inv: any) => inv.status === status);
        if (demo !== null) {
            const isDemo = demo === 'true';
            invoices = invoices.filter((inv: any) => inv.demo === isDemo);
        }

        // Stats
        const stats = {
            total: invoices.length,
            pending: invoices.filter((i: any) => i.status === 'pending').length,
            paid: invoices.filter((i: any) => i.status === 'paid').length,
            overdue: invoices.filter((i: any) => i.status === 'overdue').length,
            totalAmount: invoices.reduce((sum: number, i: any) => sum + (i.amount || 0), 0),
            paidAmount: invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + (i.amount || 0), 0),
        };

        return NextResponse.json({ invoices, stats });
    } catch (error) {
        console.error('Errore lettura pagamenti:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { invoiceId, status, paymentMethod, notes } = await request.json();

        if (!invoiceId) {
            return NextResponse.json({ error: 'invoiceId richiesto' }, { status: 400 });
        }

        if (!fs.existsSync(INVOICES_PATH)) {
            return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(INVOICES_PATH, 'utf-8'));
        const index = data.invoices.findIndex((inv: any) => inv.id === invoiceId);

        if (index === -1) {
            return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
        }

        // Aggiorna stato
        data.invoices[index].status = status;
        data.invoices[index].updatedAt = new Date().toISOString();

        if (status === 'paid') {
            data.invoices[index].paidAt = new Date().toISOString();
            if (paymentMethod) data.invoices[index].paymentMethod = paymentMethod;
        }

        if (notes) {
            data.invoices[index].adminNotes = notes;
        }

        fs.writeFileSync(INVOICES_PATH, JSON.stringify(data, null, 2));

        console.log(`✅ [ADMIN] Fattura ${invoiceId} aggiornata: ${status}`);

        return NextResponse.json({
            success: true,
            message: 'Fattura aggiornata',
            invoice: data.invoices[index]
        });
    } catch (error) {
        console.error('Errore aggiornamento pagamento:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
