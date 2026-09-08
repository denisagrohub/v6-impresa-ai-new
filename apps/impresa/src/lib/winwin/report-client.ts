// Client per il report Win-Win asincrono (prompt web-async, 06/09/2026).
// Chiamata di stato LEGGERA, mai in un ciclo di polling: il chiamante
// (InterviewTreeFlow.tsx) la usa una volta sola dopo un'attesa fissa.

export interface WinwinReportStatus {
    stato: 'in_elaborazione' | 'pronto';
    report_url: string | null;
}

async function parseOrThrow(response: Response): Promise<any> {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(body?.error || `Richiesta fallita (${response.status})`);
    }
    return body;
}

export async function checkWinwinReportStatus(token: string): Promise<WinwinReportStatus> {
    const response = await fetch(`/api/winwin-report/status?token=${encodeURIComponent(token)}`);
    return parseOrThrow(response);
}

// Render_data del teaser pre-pagamento (preview=true sempre) - usato SOLO
// dalla pagina /report/[token]. Tipizzato in modo permissivo (le chiavi
// vengono lette direttamente dal motore erpv6_winwin_renderdata lato Odoo,
// non rigenerate/interpretate qui) per non duplicare uno schema che vive
// gia' nel Motore backend.
export interface WinwinReportData {
    client_info: { tipo_progetto: string; azienda: string; data: string };
    diagnosi: { metriche: Array<{ nome: string; valore: string; stato: string; riferimento: string }> };
    impatto: number;
    prontezza: number;
    etichetta_azienda: string;
    sintesi: string | null;
    criticita: Array<Record<string, any>>;
    azioni_urgenti: Array<Record<string, any>>;
    schede: Array<Record<string, any>>;
    roadmap: Array<{ titolo: string; tempistica: string; descrizione: string }>;
    raccomandazione: string | null;
    fonti: string[];
    preview: true;
    consultant_booking_id: number | false;
}

export async function fetchWinwinReportData(token: string): Promise<WinwinReportData> {
    const response = await fetch(`/api/winwin-report/data?token=${encodeURIComponent(token)}`);
    return parseOrThrow(response);
}
