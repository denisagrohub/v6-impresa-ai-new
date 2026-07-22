import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission, handleAuthError } from '@/lib/auth';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');
const DAILY_API_URL = 'https://api.daily.co/v1';

function getDailyApiKey(): string | null {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return null;
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        return config.callAI?.dailyApiKey || null;
    } catch (error) {
        console.error('Errore lettura Daily API key:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = requirePermission(request, ['consultant.use_call_ai']);

        const { projectId, consultantId, duration = 60 } = await request.json();

        // Verifica che il consulente stia creando una room per se stesso
        if (consultantId !== user.id && user.role !== 'admin' && user.role !== 'chief') {
            return NextResponse.json(
                { error: 'Non puoi creare room per altri consulenti' },
                { status: 403 }
            );
        }

        const DAILY_API_KEY = getDailyApiKey();
        if (!DAILY_API_KEY) {
            return NextResponse.json(
                {
                    error: 'DAILY_API_KEY non configurata. Vai in Admin → Impostazioni Sistema → Call AI Configuration per inserirla.',
                    code: 'MISSING_API_KEY'
                },
                { status: 500 }
            );
        }

        const roomName = `call-${projectId}-${Date.now()}`;
        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: roomName,
                privacy: 'private',
                properties: {
                    exp: Math.floor(Date.now() / 1000) + (duration * 60),
                    start_audio_off: false,
                    start_video_off: false,
                    enable_chat: true,
                    enable_screenshare: true,
                    max_participants: 5,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.info?.message || 'Errore creazione room');
        }

        const room = await response.json();

        const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                room_name: roomName,
                is_owner: true,
            }),
        });

        const tokenData = await tokenResponse.json();

        return NextResponse.json({
            success: true,
            room: {
                name: roomName,
                url: room.url,
                token: tokenData.token,
                exp: room.exp,
            },
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
