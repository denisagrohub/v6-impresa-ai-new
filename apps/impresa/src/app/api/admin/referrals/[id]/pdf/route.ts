import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

// GET /api/admin/referrals/[id]/pdf — restituisce il PDF generato
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  try {
    await odoo.connect();
    const [r] = await odoo.execute('erpv6.referral', 'read', [[id], ['accordo_pdf', 'accordo_pdf_name']]);
    if (!r?.accordo_pdf) {
      return NextResponse.json({ success: false, error: 'PDF non ancora generato' }, { status: 404 });
    }
    const pdfBuffer = Buffer.from(r.accordo_pdf, 'base64');
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${r.accordo_pdf_name || `accordo_${id}.pdf`}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 502 });
  }
}
