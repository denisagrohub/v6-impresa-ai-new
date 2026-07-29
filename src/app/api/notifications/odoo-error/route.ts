import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log('📧 NOTIFICA ADMIN - ERRORE ODOO');
    console.log('   Timestamp:', data.timestamp);
    console.log('   Errore:', data.error);
    console.log('   UserAgent:', data.userAgent || 'N/A');

    // In produzione: invia email
    // await sendEmail({
    //   to: 'admin@progettoimpresa.it',
    //   subject: '⚠️ ERRORE CONNESSIONE ODOO',
    //   html: `<h2>Errore connessione Odoo</h2><p>${data.error}</p>`
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Errore' }, { status: 500 });
  }
}
