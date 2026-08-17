import { NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

// Proxy pubblico verso GET /api/v1/verticals (erpv6.vertical.catalog) - usato
// dalla domanda 'settore' dell'intervista per una lista reale invece di
// testo libero. Se il catalogo non e' ancora popolato o Odoo non e'
// raggiungibile, ritorna semplicemente [] cosi' la domanda degrada al
// campo testo originale invece di rompere l'intervista.
export async function GET() {
    if (!isOdooEnabled()) {
        return NextResponse.json([]);
    }
    try {
        const verticals = await callOdooAPI('/api/v1/verticals', { method: 'GET' });
        return NextResponse.json(Array.isArray(verticals) ? verticals : []);
    } catch (error) {
        console.debug('Verticali non disponibili (non bloccante):', error);
        return NextResponse.json([]);
    }
}
