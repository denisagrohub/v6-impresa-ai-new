import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DASHBOARD_MOCK_PATH = path.join(process.cwd(), 'src/data/dashboard-mock.json');
const INVOICES_PATH = path.join(process.cwd(), 'src/data/invoices.json');

function loadJson(filePath: string) {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export async function GET(request: NextRequest) {
    try {
        // Carica i dati base del progetto
        const dashboardMock = loadJson(DASHBOARD_MOCK_PATH);
        const invoicesData = loadJson(INVOICES_PATH);

        if (!dashboardMock) {
            return NextResponse.json({ error: 'Dashboard non configurata' }, { status: 500 });
        }

        // Se non ci sono fatture, ritorna i dati mock così come sono
        if (!invoicesData || !invoicesData.invoices) {
            return NextResponse.json(dashboardMock);
        }

        // Mappa lo stato reale delle fatture sui pagamenti della dashboard
        const pagamentiAggiornati = dashboardMock.pagamenti.map((pagamento: any) => {
            // Cerca la fattura corrispondente (match per linkPagamento o descrizione simile)
            const invoiceId = pagamento.linkPagamento?.replace('/checkout/', '');
            const invoice = invoiceId
                ? invoicesData.invoices.find((inv: any) => inv.id === invoiceId)
                : null;

            if (invoice) {
                return {
                    ...pagamento,
                    stato: invoice.status === 'paid' ? 'pagato' :
                        invoice.status === 'pending' ? 'in_attesa' :
                            pagamento.stato,
                    data: invoice.status === 'paid' ? new Date(invoice.paidAt).toLocaleDateString('it-IT') : pagamento.data,
                };
            }

            return pagamento;
        });

        // Ricalcola le statistiche in base allo stato reale
        const totaleProgetto = pagamentiAggiornati.reduce((sum: number, p: any) => sum + p.importo, 0);
        const pagato = pagamentiAggiornati
            .filter((p: any) => p.stato === 'pagato')
            .reduce((sum: number, p: any) => sum + p.importo, 0);
        const daPagare = totaleProgetto - pagato;

        const dashboardAggiornata = {
            ...dashboardMock,
            pagamenti: pagamentiAggiornati,
            stats: {
                ...dashboardMock.stats,
                totaleProgetto,
                pagato,
                daPagare,
            },
        };

        return NextResponse.json(dashboardAggiornata);
    } catch (error) {
        console.error('Errore caricamento dashboard:', error);
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
    }
}
