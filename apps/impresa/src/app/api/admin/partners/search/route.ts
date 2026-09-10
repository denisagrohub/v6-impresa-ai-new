import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "quando si aggiungono parti collegate dentro un
// progetto non è possibile selezionare un contatto, deve essere
// possibile selezionarlo o crearlo") - ricerca reale su res.partner per
// l'autocomplete del form "Aggiungi Parte Collegata".
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ success: true, partners: [] });

  try {
    await odoo.connect();
    const partners = await odoo.execute('res.partner', 'search_read', [
      ['|', ['name', 'ilike', q], ['email', 'ilike', q]],
      ['id', 'name', 'email', 'phone'], 0, 8,
    ]);
    return NextResponse.json({ success: true, partners: partners || [] });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/partners/search:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
