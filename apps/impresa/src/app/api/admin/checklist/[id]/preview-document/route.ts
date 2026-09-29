// POST /api/admin/checklist/[id]/preview-document
// Genera PDF anteprima step (C6a). Ritorna pdf_base64 + draft_id.
import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { isOdooEnabled } from '@/config/system';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });
  try {
    const result = await callOdooAPI(
      `/api/v1/admin/checklist/${params.id}/preview-document`,
      { method: 'POST', headers: { Authorization: authHeader } },
    );
    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
