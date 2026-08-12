import { NextRequest, NextResponse } from 'next/server';
import { sixthManSystem } from '@/lib/review/sixth-man';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, documentId, documentType, reviewerRole, errors, notes } = body;

    if (action === 'start') {
      const review = sixthManSystem.startReview(documentId, documentType);
      return NextResponse.json({ success: true, review });
    }

    if (action === 'review') {
      const result = sixthManSystem.review(documentId, reviewerRole, errors || [], notes || '');
      return NextResponse.json({ 
        success: result.success,
        nextReviewer: result.nextReviewer,
        errorsFound: result.errorsFound,
      });
    }

    if (action === 'status') {
      const status = sixthManSystem.getReviewStatus(documentId);
      return NextResponse.json({ success: true, status });
    }

    if (action === 'report') {
      const report = sixthManSystem.generateReport(documentId);
      return NextResponse.json({ success: true, report });
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore durante la revisione' },
      { status: 500 }
    );
  }
}
