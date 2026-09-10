import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// 10/09/2026 (Denis: "sui consulenti un pulsante per modificare i dati").
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  try {
    await odoo.connect();
    const consultants = await odoo.execute('erpv6.consulting.consultant', 'search_read', [
      [['id', '=', id]],
      ['id', 'partner_id', 'brand_id', 'hourly_rate', 'commission_rate', 'zone', 'languages', 'specialties', 'fiscal_code', 'vat_number', 'is_active'],
    ]);
    if (!consultants || !consultants.length) {
      return NextResponse.json({ success: false, error: 'Consulente non trovato' }, { status: 404 });
    }
    const c = consultants[0];
    const partnerId = Array.isArray(c.partner_id) ? c.partner_id[0] : null;
    const partners = partnerId
      ? await odoo.execute('res.partner', 'search_read', [[['id', '=', partnerId]], ['name', 'email', 'phone']])
      : [];
    const partner = partners && partners[0];

    return NextResponse.json({
      success: true,
      consultant: {
        id: c.id,
        name: partner?.name || (Array.isArray(c.partner_id) ? c.partner_id[1] : ''),
        email: partner?.email || '',
        phone: partner?.phone || '',
        brandId: Array.isArray(c.brand_id) ? c.brand_id[0] : null,
        hourlyRate: c.hourly_rate,
        commissionRate: c.commission_rate,
        zone: c.zone || '',
        languages: c.languages || '',
        specialties: c.specialties || '',
        fiscalCode: c.fiscal_code || '',
        vatNumber: c.vat_number || '',
        isActive: c.is_active,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Errore di connessione a Odoo' }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 });
  }
  const {
    name, email, phone, vatNumber, fiscalCode, zone, languages, specialties,
    brandId, hourlyRate, commissionRate, isActive,
  } = body || {};

  try {
    await odoo.connect();

    const consultants = await odoo.execute('erpv6.consulting.consultant', 'search_read', [
      [['id', '=', id]], ['id', 'partner_id'],
    ]);
    if (!consultants || !consultants.length) {
      return NextResponse.json({ success: false, error: 'Consulente non trovato' }, { status: 404 });
    }
    const partnerId = Array.isArray(consultants[0].partner_id) ? consultants[0].partner_id[0] : null;

    if (partnerId && (name || email || phone !== undefined || vatNumber !== undefined)) {
      const partnerVals: any = {};
      if (name) partnerVals.name = name;
      if (email) partnerVals.email = email;
      if (phone !== undefined) partnerVals.phone = phone || false;
      if (vatNumber !== undefined) partnerVals.vat = vatNumber || false;
      if (Object.keys(partnerVals).length) {
        await odoo.execute('res.partner', 'write', [[partnerId], partnerVals]);
      }
    }

    const consultantVals: any = {};
    if (brandId) consultantVals.brand_id = Number(brandId);
    if (hourlyRate !== undefined) consultantVals.hourly_rate = Number(hourlyRate) || 0;
    if (commissionRate !== undefined) consultantVals.commission_rate = Number(commissionRate) || 0;
    if (fiscalCode !== undefined) consultantVals.fiscal_code = fiscalCode || false;
    if (vatNumber !== undefined) consultantVals.vat_number = vatNumber || false;
    if (zone !== undefined) consultantVals.zone = zone || false;
    if (languages !== undefined) consultantVals.languages = languages || false;
    if (specialties !== undefined) consultantVals.specialties = specialties || false;
    if (isActive !== undefined) consultantVals.is_active = !!isActive;
    if (Object.keys(consultantVals).length) {
      await odoo.execute('erpv6.consulting.consultant', 'write', [[id], consultantVals]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Errore PUT /api/admin/consultants/[id]:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'Modifica fallita' }, { status: 502 });
  }
}
