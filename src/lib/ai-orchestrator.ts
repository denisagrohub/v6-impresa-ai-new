// src/lib/ai-orchestrator.ts
export type AIProvider = 'claude' | 'groq';

export interface CallAnalysisResult {
    kairos_update: { score: number; quadrante: string };
    heinrich_signals: { verdi: string[]; gialle: string[]; rosse: string[] };
    psychological_patterns: string[];
    suggested_actions: string[];
}

export async function analyzeCallTranscript(
    transcript: string,
    provider: AIProvider = 'groq'
): Promise<CallAnalysisResult> {
    console.log(`🤖 Analisi call in corso con provider: ${provider}`);

    // Simulazione latenza (in produzione: chiamata reale a Anthropic/Groq SDK)
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
        kairos_update: { score: 12, quadrante: "KAIROS_AUTENTICO" },
        heinrich_signals: {
            verdi: ["Cliente ha confermato la disponibilità budget"],
            gialle: ["Richiesta di chiarimento sui tempi di consegna"],
            rosse: []
        },
        psychological_patterns: ["PL-02 (Linguaggio inclusivo 'noi')", "DM-06 (Focus sul ROI)"],
        suggested_actions: [
            "Inviare Financial Model con scenario worst-case entro 24h",
            "Pianificare call di follow-up con il CFO"
        ]
    };
}

export async function getAIProviderConfig(): Promise<{ provider: AIProvider; enabled: boolean }> {
    return {
        provider: (process.env.AI_DEFAULT_PROVIDER as AIProvider) || 'groq',
        enabled: process.env.AI_ENABLED === 'true'
    };
}
