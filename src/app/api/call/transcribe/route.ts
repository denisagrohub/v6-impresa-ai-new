import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');

function getApiKeys() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { deepgram: null, anthropic: null };
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        return {
            deepgram: config.callAI?.deepgramApiKey || null,
            anthropic: config.callAI?.anthropicApiKey || null
        };
    } catch (error) {
        console.error('Errore lettura API keys:', error);
        return { deepgram: null, anthropic: null };
    }
}

// GET: Configurazione Deepgram per il client
export async function GET(request: NextRequest) {
    try {
        const { deepgram: DEEPGRAM_API_KEY } = getApiKeys();

        if (!DEEPGRAM_API_KEY) {
            return NextResponse.json(
                {
                    error: 'DEEPGRAM_API_KEY non configurata. Vai in Admin → Impostazioni Sistema → Call AI Configuration.',
                    code: 'MISSING_API_KEY'
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            apiKey: DEEPGRAM_API_KEY,
            options: {
                model: 'nova-2',
                language: 'it',
                smart_format: true,
                diarize: true,
                interim_results: true,
                utterance_end_ms: 1000,
                vad_events: true,
            },
        });
    } catch (error: any) {
        console.error('Errore Deepgram:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

// POST: Analisi pattern su trascrizione completa
export async function POST(request: NextRequest) {
    try {
        const { transcript, projectId } = await request.json();
        const { anthropic: ANTHROPIC_API_KEY } = getApiKeys();

        if (!ANTHROPIC_API_KEY) {
            return NextResponse.json(
                {
                    error: 'ANTHROPIC_API_KEY non configurata. Vai in Admin → Impostazioni Sistema → Call AI Configuration.',
                    code: 'MISSING_API_KEY'
                },
                { status: 500 }
            );
        }

        if (!transcript || transcript.length < 50) {
            return NextResponse.json(
                { error: 'Trascrizione troppo corta per analisi' },
                { status: 400 }
            );
        }

        // Carica KB per analisi pattern
        const kb = loadKBForAnalysis();

        // Analizza pattern con Claude
        const analysis = await analyzeWithClaude(transcript, kb, ANTHROPIC_API_KEY);

        return NextResponse.json({
            success: true,
            analysis,
        });
    } catch (error: any) {
        console.error('Errore analisi:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

function loadKBForAnalysis() {
    const modules = ['psychology-PL', 'psychology-PC', 'psychology-DISC', 'psychology-OB'];
    const kb: any = {};

    for (const module of modules) {
        const plainPath = path.join(process.cwd(), `src/data/kb/plain/${module}.json`);
        if (fs.existsSync(plainPath)) {
            kb[module] = JSON.parse(fs.readFileSync(plainPath, 'utf-8'));
        }
    }

    return kb;
}

async function analyzeWithClaude(transcript: string, kb: any, apiKey: string) {
    const { Anthropic } = await import('@anthropic-ai/sdk');

    const anthropic = new Anthropic({
        apiKey: apiKey,
    });

    const prompt = `Sei un esperto di psicologia commerciale e pattern linguistici applicati alle vendite B2B.

Analizza questa trascrizione di una call commerciale e identifica:

1. **Pattern Linguistici (PL)** rilevati dalla KB:
${JSON.stringify(kb['psychology-PL']?.patterns || [], null, 2)}

2. **Pattern Comportamentali (PC)** rilevati:
${JSON.stringify(kb['psychology-PC']?.patterns || [], null, 2)}

3. **Profilo DISC** stimato del cliente (D/I/S/C):
${JSON.stringify(kb['psychology-DISC']?.profiles || [], null, 2)}

4. **Obiezioni (OB)** identificate:
${JSON.stringify(kb['psychology-OB']?.objections || [], null, 2)}

5. **Impatto su Kairós** (score 5-15):
- Stato emotivo del founder
- Energia del team
- Risorse disponibili
- Pressione esterna
- Storia tentativi

6. **Segnalazioni Heinrich**:
- Verdi (near miss)
- Gialle (attenzione)
- Rosse (critiche)

Trascrizione:
"""
${transcript}
"""

Rispondi SOLO con un JSON valido in questo formato esatto:
{
  "patterns_pl": [{"id": "PL-XX", "confidence": 0-1, "evidence": "citazione"}],
  "patterns_pc": [{"id": "PC-XX", "confidence": 0-1, "evidence": "citazione"}],
  "disc_profile": {"dominant": "D|I|S|C", "secondary": "D|I|S|C", "confidence": 0-1},
  "objections": [{"id": "OB-XX", "confidence": 0-1, "suggested_response": "testo"}],
  "kairos_update": {
    "score": 5-15,
    "indicatori": {
      "stato_emotivo": 1-3,
      "energia_team": 1-3,
      "risorse": 1-3,
      "pressione_esterna": 1-3,
      "storia_tentativi": 1-3
    },
    "quadrante": "PREPARA|KAIROS_AUTENTICO|QUICK_WIN|PARCHEGGIO"
  },
  "heinrich_signals": {
    "verdi": [{"descrizione": "testo"}],
    "gialle": [{"descrizione": "testo"}],
    "rosse": [{"descrizione": "testo"}]
  },
  "sintesi": "Breve sintesi in italiano (max 200 parole)",
  "azioni_suggerite": ["azione 1", "azione 2"]
}`;

    const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{
            role: 'user',
            content: prompt,
        }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Estrai JSON dalla risposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Risposta Claude non valida');
    }

    return JSON.parse(jsonMatch[0]);
}
