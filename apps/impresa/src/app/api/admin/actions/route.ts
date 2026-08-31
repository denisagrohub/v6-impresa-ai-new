import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
    // Chiamata all'endpoint del catalogo azioni su Odoo erpv6_core_engine
    const res = await fetch(`${odooUrl}/api/v1/intelligent/actions`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Odoo API responded with status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch action catalog from Odoo', details: error.message },
      { status: 500 }
    );
  }
}
