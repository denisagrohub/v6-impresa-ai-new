import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: sistema la pagina Pagamenti con dati reali) - due
// fonti reali distinte, mai fuse in una finta unica: i pagamenti online
// Win-Win (sale.order/payment nativo Odoo, gia' collegato in sessione) e
// le tranche/SAL di consulenza (erpv6.production.order.tranche, conferma
// MANUALE per scelta esplicita di Denis - "non serve integrare un vero
// sistema di pagamento esterno", vedi prodotto_consulenza.py).
export async function GET() {
  try {
    await odoo.connect();

    const [orders, tranches] = await Promise.all([
      odoo.execute('sale.order', 'search_read', [
        [['state', '=', 'sale']],
        ['id', 'name', 'partner_id', 'amount_total', 'date_order', 'invoice_status'],
        0, 100, 'date_order desc',
      ]),
      odoo.execute('erpv6.production.order.tranche', 'search_read', [
        [],
        ['id', 'name', 'order_id', 'tranche_number', 'importo', 'currency_id', 'stato', 'data_incasso', 'confirmed_by'],
        0, 200, 'id desc',
      ]),
    ]);

    return NextResponse.json({
      success: true,
      onlinePayments: (orders || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        cliente: Array.isArray(o.partner_id) ? o.partner_id[1] : '—',
        importo: o.amount_total,
        data: o.date_order,
        statoFatturazione: o.invoice_status,
      })),
      tranches: (tranches || []).map((t: any) => ({
        id: t.id,
        nome: t.name,
        progetto: Array.isArray(t.order_id) ? t.order_id[1] : '—',
        progettoId: Array.isArray(t.order_id) ? t.order_id[0] : null,
        numero: t.tranche_number,
        importo: t.importo,
        stato: t.stato,
        dataIncasso: t.data_incasso || null,
        confermatoDa: Array.isArray(t.confirmed_by) ? t.confirmed_by[1] : null,
      })),
    });
  } catch (error: any) {
    console.error('❌ Errore /api/admin/payments:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}
