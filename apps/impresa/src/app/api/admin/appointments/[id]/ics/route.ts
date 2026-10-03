import { NextRequest, NextResponse } from 'next/server';
import { isOdooEnabled } from '@/config/system';

const ODOO_URL = process.env.NEXT_PUBLIC_API_URL || 'https://erp.v6sviluppoimpresa.it';

// 03/10/2026 (C1b-agenda-1b): download .ics binario dal gateway.
// Pattern: arrayBuffer + Content-Type text/calendar (non JSON).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const authHeader = request.headers.get('authorization') || request.headers.get('cookie') || '';
  try {
    const res = await fetch(`${ODOO_URL}/api/v1/admin/appointments/${params.id}/ics`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    const cd = res.headers.get('content-disposition') || `attachment; filename=event-${params.id}.ics`;
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': cd },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
