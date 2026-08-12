import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, sector, discProfile, target, mission } = body;

    // In produzione, chiama Odoo: /api/kb/color-palette e /api/kb/storytelling
    // Mock per demo
    const palette = {
      primary: '#1a237e',
      secondary: '#0d47a1',
      accent: '#ed8936',
      background: '#ffffff',
      text: '#1a1a1a',
    };

    const story = `${companyName} nasce con la missione di ${mission || 'creare valore'} nel settore ${sector}. Il brand riflette un profilo ${discProfile}, ideale per un target ${target}.`;

    return NextResponse.json({
      success: true,
      result: {
        companyName,
        sector,
        discProfile,
        target,
        palette,
        story,
        mission,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Errore generazione report' }, { status: 500 });
  }
}
