import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "fondi le due cose perche' entrambe servono" -
// unire la pagina "Nuovo Consulente" con i campi contrattuali reali, che
// prima scriveva solo su un file JSON locale, con il flusso reale gia'
// esistente lato Odoo). hourly_rate/commission_rate/zone/languages/
// specialties/fiscal_code/vat_number sono TUTTI campi reali gia'
// esistenti su erpv6.consulting.consultant (verificato leggendo il
// modello, non nella dashboard extension che ne mostra solo un
// sottoinsieme) - nessun campo inventato qui.
//
// Il partner viene cercato per email e creato solo se non esiste
// (stesso pattern find-or-create di action_create_referral lato Odoo,
// coerente). NESSUNA credenziale di accesso viene creata qui - stessa
// scelta esplicita gia' presa nella tab Amministrazione di Odoo
// ("mai crea credenziali d'accesso, fuori scope esplicito"): il
// consulente puo' lavorare (link di prenotazione, email) senza un login
// Odoo proprio.
export async function GET() {
  try {
    await odoo.connect();
    const consultants = await odoo.execute('erpv6.consulting.consultant', 'search_read', [
      [], ['id', 'partner_id', 'brand_id', 'hourly_rate', 'commission_rate', 'zone', 'is_active'], 0, 0, 'id desc',
    ]);
    return NextResponse.json({
      success: true,
      consultants: (consultants || []).map((c: any) => ({
        id: c.id,
        name: Array.isArray(c.partner_id) ? c.partner_id[1] : '—',
        partnerId: Array.isArray(c.partner_id) ? c.partner_id[0] : null,
        brand: Array.isArray(c.brand_id) ? c.brand_id[1] : '—',
        hourlyRate: c.hourly_rate,
        commissionRate: c.commission_rate,
        zone: c.zone || '',
        isActive: c.is_active,
      })),
    });
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

  const {
    name, email, phone, vatNumber, fiscalCode, zone, languages, specialties,
    brandId, hourlyRate, commissionRate,
  } = body || {};

  if (!name || !email || !brandId) {
    return NextResponse.json({ success: false, error: 'Nome, email e brand sono obbligatori' }, { status: 400 });
  }

  try {
    await odoo.connect();

    const existingPartners = await odoo.execute('res.partner', 'search_read', [
      [['email', '=', email]], ['id'], 0, 1,
    ]);
    let partnerId: number;
    if (existingPartners && existingPartners.length) {
      partnerId = existingPartners[0].id;
    } else {
      partnerId = await odoo.execute('res.partner', 'create', [{
        name, email, phone: phone || false, vat: vatNumber || false,
      }]);
    }

    const existingConsultant = await odoo.execute('erpv6.consulting.consultant', 'search_read', [
      [['partner_id', '=', partnerId]], ['id'], 0, 1,
    ]);
    if (existingConsultant && existingConsultant.length) {
      return NextResponse.json({ success: false, error: `Esiste già un consulente collegato a questa email (id ${existingConsultant[0].id})` }, { status: 409 });
    }

    const consultantId = await odoo.execute('erpv6.consulting.consultant', 'create', [{
      partner_id: partnerId,
      brand_id: Number(brandId),
      hourly_rate: hourlyRate ? Number(hourlyRate) : 0,
      commission_rate: commissionRate ? Number(commissionRate) : 0,
      fiscal_code: fiscalCode || false,
      vat_number: vatNumber || false,
      zone: zone || false,
      languages: languages || false,
      specialties: specialties || false,
    }]);

    return NextResponse.json({ success: true, consultantId, partnerId });
  } catch (error: any) {
    console.error('❌ Errore POST /api/admin/consultants:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Creazione fallita' }, { status: 502 });
  }
}
