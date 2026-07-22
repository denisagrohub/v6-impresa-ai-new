// src/types/call-feedback.ts
export interface CallFeedback {
    callId: string;
    projectId: string;
    consultantId: string;
    timestamp: string;

    // Pattern evaluation
    patterns: Array<{
        patternId: string; // PL-02, PL-12, etc.
        detected: boolean;
        accuracy: 'correct' | 'partial' | 'incorrect';
        comment?: string;
    }>;

    // DISC evaluation
    disc: {
        aiProfile: string; // "D 70% + I 20%"
        accuracy: 'very_accurate' | 'somewhat' | 'not_accurate';
        correctedProfile?: string; // "S" if not accurate
        comment?: string;
    };

    // Kairós evaluation
    kairos: {
        aiScore: number; // 11
        aiQuadrant: string; // "KAIROS_AUTENTICO"
        accuracy: 'very_accurate' | 'somewhat' | 'not_accurate';
        correctedQuadrant?: string;
        comment?: string;
    };

    // Objections evaluation
    objections: Array<{
        objectionId: string; // OB-01, OB-02
        detected: boolean;
        handledCorrectly: 'yes' | 'no' | 'partial';
        handlingTechnique?: string;
        comment?: string;
    }>;

    // Overall
    overallAccuracy: number; // 0-100
    suggestions?: string[];
}
