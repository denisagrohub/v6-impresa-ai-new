import { NextRequest, NextResponse } from 'next/server';
import { heinrichSystem } from '@/lib/risk/heinrich-system';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = heinrichSystem.getStats(projectId || undefined);
      return NextResponse.json({ success: true, stats });
    }

    if (action === 'report') {
      const report = heinrichSystem.generateReport(projectId || undefined);
      return NextResponse.json({ success: true, report });
    }

    return NextResponse.json(
      { error: 'Azione non valida' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = heinrichSystem.createEvent(body);
    return NextResponse.json({ success: true, event });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore creazione evento' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const event = heinrichSystem.updateEvent(id, data);
    if (!event) {
      return NextResponse.json(
        { error: 'Evento non trovato' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, event });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore aggiornamento' },
      { status: 500 }
    );
  }
}
