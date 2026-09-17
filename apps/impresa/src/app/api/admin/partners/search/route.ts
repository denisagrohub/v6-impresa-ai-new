import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026: ricerca res.partner per autocomplete "Aggiungi Parte".
// EVOLUZIONE (scheda completa): aggiunto is_company ai campi e parametro
// ?company=1 per cercare SOLO aziende (usato dalla RichPartModal).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const onlyCompany = searchParams.get('company') === '1';
  if (q.length < 2) return NextResponse.json({ success: true, partners: [] });

  try {
    await odoo.connect();
    // '|'(nome|email) + eventuale filtro azienda
    const domain: any[] = [['|', ['name', 'ilike', q], ['email', 'ilike', q]]];
    if (onlyCompany) domain.push(['is_company', '=', true]);
    const partners = await odoo.execute('res.partner', 'search_read', [
      domain, ['id', 'name', 'email', 'phone', 'is_company'], 0, 8,
    ]);
    return NextResponse.json({ success: true, partners: partners || [] });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partners/search:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
