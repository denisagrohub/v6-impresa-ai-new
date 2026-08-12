import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FEEDBACK_PATH = path.join(process.cwd(), 'src/data/call-feedback.json');

export async function POST(request: NextRequest) {
    try {
        const feedback = await request.json();

        // Salva feedback
        let allFeedback: any[] = [];
        if (fs.existsSync(FEEDBACK_PATH)) {
            allFeedback = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf-8'));
        }

        allFeedback.push({
            ...feedback,
            id: `FB-${Date.now()}`,
            savedAt: new Date().toISOString()
        });

        fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(allFeedback, null, 2));

        // Calcola accuracy rate del consulente
        const consultantFeedback = allFeedback.filter(
            (f: any) => f.consultantId === feedback.consultantId
        );

        const totalEvaluations = consultantFeedback.reduce((sum: number, f: any) => {
            return sum + f.patterns.length + (f.disc ? 1 : 0) + (f.kairos ? 1 : 0) + f.objections.length;
        }, 0);

        const correctEvaluations = consultantFeedback.reduce((sum: number, f: any) => {
            const patternCorrect = f.patterns.filter((p: any) => p.accuracy === 'correct').length;
            const discCorrect = f.disc?.accuracy === 'very_accurate' ? 1 : 0;
            const kairosCorrect = f.kairos?.accuracy === 'very_accurate' ? 1 : 0;
            const objectionsCorrect = f.objections.filter((o: any) => o.handledCorrectly === 'yes').length;
            return sum + patternCorrect + discCorrect + kairosCorrect + objectionsCorrect;
        }, 0);

        const accuracyRate = totalEvaluations > 0
            ? Math.round((correctEvaluations / totalEvaluations) * 100)
            : 0;

        // Genera suggerimenti basati sui pattern errati
        const suggestions = generateSuggestions(consultantFeedback);

        return NextResponse.json({
            success: true,
            accuracyRate,
            suggestions,
            totalCalls: consultantFeedback.length
        });

    } catch (error) {
        console.error('Errore salvataggio feedback:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}

function generateSuggestions(feedback: any[]): string[] {
    const suggestions: string[] = [];

    // Analizza pattern più spesso errati
    const patternErrors = new Map<string, number>();
    feedback.forEach((f: any) => {
        f.patterns.forEach((p: any) => {
            if (p.accuracy === 'incorrect') {
                patternErrors.set(p.patternId, (patternErrors.get(p.patternId) || 0) + 1);
            }
        });
    });

    // Suggerimento per pattern più problematico
    if (patternErrors.size > 0) {
        const mostErrorProne = Array.from(patternErrors.entries())
            .sort((a, b) => b[1] - a[1])[0];

        suggestions.push(
            `Presta attenzione al pattern ${mostErrorProne[0]}: è stato errato ${mostErrorProne[1]} volte.`
        );
    }

    // Suggerimento per DISC
    const discInaccurate = feedback.filter((f: any) => f.disc?.accuracy === 'not_accurate').length;
    if (discInaccurate > feedback.length * 0.3) {
        suggestions.push(
            "Il profilo DISC viene spesso identificato in modo errato. Considera di osservare più attentamente il linguaggio non verbale."
        );
    }

    return suggestions;
}
