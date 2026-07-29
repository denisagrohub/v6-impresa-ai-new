import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, feedback, checklist, callScheduled } = await request.json();
    const bpId = params.id;

    console.log(`BP ${bpId} - Revisione consulente: ${status}`, { feedback, checklist });

    // In produzione: salva su Odoo
    // Aggiorna lo stato del progetto

    return NextResponse.json({
      success: true,
      status,
      feedback,
      sentToClient: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore durante la revisione' },
      { status: 500 }
    );
  }
}
