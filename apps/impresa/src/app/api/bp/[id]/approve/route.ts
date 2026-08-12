import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { feedback, approved } = await request.json();
    const bpId = params.id;

    // In produzione: salva su Odoo
    console.log(`BP ${bpId} ${approved ? 'APPROVATO' : 'RIFIUTATO'}`, { feedback });

    // Registra su blockchain (se approvato)
    if (approved) {
      // Chiamata al servizio blockchain
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/blockchain/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bp_approved',
          bpId,
          timestamp: new Date().toISOString(),
        }),
      });
    }

    return NextResponse.json({
      success: true,
      status: approved ? 'approved' : 'rejected',
      feedback,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore durante l\'approvazione' },
      { status: 500 }
    );
  }
}
