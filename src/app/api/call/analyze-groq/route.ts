import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');

export async function POST(request: NextRequest) {
    try {
        const { transcript, projectId } = await request.json();

        if (!fs.existsSync(CONFIG_PATH)) {
            return NextResponse.json({ error: 'Config non trovata' }, { status: 500 });
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        const groqApiKey = config.callAI?.groqApiKey;

        if (!groqApiKey) {
            return NextResponse.json({
                error: 'GROQ_API_KEY non configurata. Vai in Admin → Impostazioni → Call AI Configuration'
            }, { status: 500 });
        }

        if (!transcript || transcript.length < 50) {
            return NextResponse.json({ error: 'Trascrizione troppo corta' }, { status: 400 });
        }

        const groq = new Groq({ apiKey: groqApiKey });

        const prompt = `Sei un esperto di psicologia commerciale e pattern linguistici applicati alle vendite B2B.
Analizza questa trascrizione e identifica:
1. Pattern Linguistici (PL) rilevati
2. Pattern Comportamentali (PC) rilevati
3. Profilo DISC stimato del cliente (D/I/S/C)
4. Obiezioni (OB) identificate
5. Impatto su Kairós (score 5-15)
6. Segnalazioni Heinrich (verdi/gialle/rosse)

Trascrizione:
"""
${transcript}
"""

Rispondi SOLO con un JSON valido in questo formato:
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

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 4096,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('Risposta Groq non valida');
        }

        return NextResponse.json({
            success: true,
            analysis: JSON.parse(jsonMatch[0]),
            provider: 'groq'
        });
    } catch (error: any) {
        console.error('Errore analisi Groq:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
