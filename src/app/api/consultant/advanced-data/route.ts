import { NextRequest, NextResponse } from 'next/server';
import { advancedDataCollector } from '@/lib/interview/advanced-data-collector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, consultantId, data } = body;

    const result = await advancedDataCollector.collectDuringCall(
      leadId,
      consultantId,
      data
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        errors: result.errors,
        message: 'Dati incompleti. Completa tutti i campi prima di procedere.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Dati completi raccolti. Il Business Plan può essere generato.',
    });
  } catch (error) {
    console.error('Errore raccolta dati avanzati:', error);
    return NextResponse.json(
      { error: 'Errore durante la raccolta dei dati' },
      { status: 500 }
    );
  }
}
