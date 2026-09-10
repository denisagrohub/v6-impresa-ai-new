import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// Stesso tag/pattern gia' usato dalla tab Amministrazione in Odoo
// (erpv6_winwin_renderdata/models/admin_dashboard_extension.py,
// REFERRAL_TAG_NAME) - un referral creato qui e' lo stesso tipo di
// record, visibile anche li'.
const REFERRAL_TAG_NAME = 'Referral (Win-Win)';

export async function GET() {
  try {
    await odoo.connect();
    const tags = await odoo.execute('res.partner.category', 'search_read', [
      [['name', '=', REFERRAL_TAG_NAME]], ['id'], 0, 1,
    ]);
    if (!tags || !tags.length) {
      return NextResponse.json({ success: true, referrals: [] });
    }
    const referrals = await odoo.execute('res.partner', 'search_read', [
      [['category_id', 'in', [tags[0].id]]], ['id', 'name', 'email', 'phone'], 0, 0, 'id desc',
    ]);
    return NextResponse.json({ success: true, referrals: referrals || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const { name, email, phone } = body || {};
  if (!name) {
    return NextResponse.json({ success: false, error: 'Il nome è obbligatorio' }, { status: 400 });
  }

  try {
    await odoo.connect();
    // Riusa il metodo reale gia' verificato lato Odoo (stessa logica
    // find-or-create + tag, nessuna duplicazione qui).
    const result = await odoo.execute('res.partner', 'action_create_referral', [name, email || false, phone || false]);
    return NextResponse.json({ success: true, referral: result });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/referrals:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
