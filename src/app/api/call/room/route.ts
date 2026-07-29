import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, consultantId, duration = 30 } = body;

    // In produzione: crea room Daily.co
    // const response = await fetch('https://api.daily.co/v1/rooms', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     name: `call-${projectId}-${Date.now()}`,
    //     properties: {
    //       enable_recording: true,
    //       enable_transcription: true,
    //       start_video_off: true,
    //       max_participants: 2,
    //     },
    //   }),
    // });
    // const data = await response.json();

    // Mock per sviluppo
    return NextResponse.json({
      success: true,
      room: {
        id: `room-${Date.now()}`,
        url: `https://daily.co/call-${projectId}-${Date.now()}`,
        name: `call-${projectId}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Errore creazione room' },
      { status: 500 }
    );
  }
}
