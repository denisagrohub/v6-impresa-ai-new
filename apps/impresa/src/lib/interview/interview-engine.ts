export interface InterviewAnswer {
  // Fase 1: Profilo
  nome: string;
  email: string;
  telefono: string;
  azienda: string;
  settore: string;
  fatturato: string;
  dipendenti: string;

  // Fase 2: Progetto
  tipoProgetto: string;
  destinatario: string;
  tempistiche: string;
  budget: string;
  obiettivi: string;

  // Fase 3: Finanziario
  fatturatoAttuale?: string;
  ebitda?: string;
  investimentiPrevisti?: string;
  fabbisognoFinanziario?: string;

  // Fase 4: Mercato
  mercatoTarget?: string;
  competitorPrincipali?: string;
  vantaggioCompetitivo?: string;

  // Meta
  packageId?: string;
  assessment?: boolean;
}

export interface InterviewResult {
  score: number;
  recommendedLevel: 'L1' | 'L2' | 'L3' | 'Custom';
  estimatedPrice: number;
  summary: string;
  nextSteps: string[];
  strengths: string[];
  weaknesses: string[];
}

export class InterviewEngine {
  calculateScore(answers: InterviewAnswer): InterviewResult {
    let score = 0;
    const maxScore = 100;

    // 1. Fatturato (max 20 punti)
    const fatturatoMap: Record<string, number> = {
      '< 1M€': 5,
      '1M€ - 5M€': 10,
      '5M€ - 10M€': 15,
      '> 10M€': 20,
    };
    score += fatturatoMap[answers.fatturato] || 0;

    // 2. Dipendenti (max 15 punti)
    const dipendentiMap: Record<string, number> = {
      '< 5': 3,
      '5 - 20': 6,
      '20 - 50': 10,
      '> 50': 15,
    };
    score += dipendentiMap[answers.dipendenti] || 0;

    // 3. Budget (max 20 punti)
    const budgetMap: Record<string, number> = {
      '< €5.000': 5,
      '€5.000 - €10.000': 10,
      '€10.000 - €25.000': 15,
      '> €25.000': 20,
    };
    score += budgetMap[answers.budget] || 0;

    // 4. Tempistiche (max 15 punti)
    const tempisticheMap: Record<string, number> = {
      'Immediata (< 1 mese)': 15,
      'Breve (1-3 mesi)': 10,
      'Media (3-6 mesi)': 5,
      'Lunga (> 6 mesi)': 3,
    };
    score += tempisticheMap[answers.tempistiche] || 0;

    // 5. Destinatario (max 15 punti)
    const destinatarioMap: Record<string, number> = {
      'Banca': 15,
      'Investitore': 15,
      'Partner': 10,
      'Interno': 5,
    };
    score += destinatarioMap[answers.destinatario] || 0;

    // 6. Tipo progetto (max 15 punti)
    const tipoMap: Record<string, number> = {
      'Business Plan base': 5,
      'Piano industriale': 10,
      'Project Finance / M&A': 15,
      'Passaggio generazionale': 12,
      'Ristrutturazione debito': 15,
    };
    score += tipoMap[answers.tipoProgetto] || 0;

    // Determina il pacchetto consigliato
    let recommendedLevel: 'L1' | 'L2' | 'L3' | 'Custom' = 'L1';
    let price = 1500;

    if (score >= 75) {
      recommendedLevel = 'L3';
      price = 150000;
    } else if (score >= 50) {
      recommendedLevel = 'L2';
      price = 20000;
    } else if (score >= 25) {
      recommendedLevel = 'L1';
      price = 1500;
    } else {
      recommendedLevel = 'Custom';
      price = 500;
    }

    // Genera summary
    const summary = this.generateSummary(answers, score);

    // Genera next steps
    const nextSteps = this.generateNextSteps(recommendedLevel);

    // Genera punti di forza e debolezza
    const strengths = this.generateStrengths(answers);
    const weaknesses = this.generateWeaknesses(answers);

    return {
      score,
      recommendedLevel,
      estimatedPrice: price,
      summary,
      nextSteps,
      strengths,
      weaknesses,
    };
  }

  private generateSummary(answers: InterviewAnswer, score: number): string {
    const parts = [
      `${answers.azienda} opera nel settore ${answers.settore} con ${answers.dipendenti} dipendenti e un fatturato di ${answers.fatturato}.`,
      `Il progetto di tipo "${answers.tipoProgetto}" è destinato a ${answers.destinatario} con tempistiche "${answers.tempistiche}".`,
      `L'azienda ha un punteggio di maturità di ${score}/100.`,
    ];
    return parts.join(' ');
  }

  private generateNextSteps(level: 'L1' | 'L2' | 'L3' | 'Custom'): string[] {
    const base = ["Continua con l'intervista guidata per un'analisi più approfondita"];
    if (level === 'L1') {
      return [...base, 'Ricevi il Business Plan in 48 ore', 'Preparati per la banca'];
    } else if (level === 'L2') {
      return [...base, 'Analisi di mercato approfondita', 'Pitch Deck per investitori'];
    } else if (level === 'L3') {
      return [...base, 'Assessment strategico completo', 'Financial modeling avanzato', 'Supporto M&A'];
    }
    return [...base, 'Consulenza personalizzata'];
  }

  private generateStrengths(answers: InterviewAnswer): string[] {
    const s = [];
    if (answers.fatturato === '> 10M€') s.push('Fatturato solido');
    if (answers.dipendenti === '> 50') s.push('Team strutturato');
    if (answers.destinatario === 'Investitore') s.push('Percorso di funding chiaro');
    if (answers.tempistiche === 'Immediata (< 1 mese)') s.push('Alta determinazione');
    if (s.length === 0) s.push('Potenziale di crescita');
    return s;
  }

  private generateWeaknesses(answers: InterviewAnswer): string[] {
    const w = [];
    if (answers.fatturato === '< 1M€') w.push('Fatturato limitato');
    if (answers.dipendenti === '< 5') w.push('Team ristretto');
    if (answers.destinatario === 'Interno') w.push('Focus interno, potrebbe non servire a finanziamenti');
    if (answers.tempistiche === 'Lunga (> 6 mesi)') w.push('Tempistiche lunghe, rischio di perdere opportunità');
    if (w.length === 0) w.push('Da valutare ulteriormente');
    return w;
  }
}

export const interviewEngine = new InterviewEngine();
// ============================================================
// DATI COMPLETI PER IL BUSINESS PLAN STARTER
// ============================================================

export interface CompleteBusinessData {
  // Fase 1: già raccolti
  basic: {
    nome: string;
    email: string;
    telefono: string;
    azienda: string;
    settore: string;
    fatturato: string;
    dipendenti: string;
    tipoProgetto: string;
    destinatario: string;
    tempistiche: string;
    budget: string;
    obiettivi: string;
  };
  
  // Fase 2: da raccogliere durante la call
  advanced: {
    // Azienda
    annoFondazione: number;
    formaGiuridica: string;
    partitaIva: string;
    
    // Finanziario
    fatturatoEsatto: number;
    ebitda: number;
    investimentiPrevisti: number;
    fabbisognoFinanziario: number;
    
    // Mercato
    mercatoTarget: string;
    competitor: string[];
    vantaggioCompetitivo: string;
    quoteMercato: number;
    
    // Obiettivi
    obiettiviSpecifici: string[];
    scadenzaObiettivi: string;
    
    // Operativo
    risorseUmane: number;
    risorseTecnologiche: string;
    tempisticheDettagliate: string;
    
    // Rischi
    rischiSpecifici: string[];
    mitigazioni: string[];
  };
}

// ============================================================
// VALIDAZIONE DATI COMPLETI
// ============================================================
export function validateCompleteData(data: CompleteBusinessData): string[] {
  const errors: string[] = [];
  
  if (!data.advanced.annoFondazione) errors.push('Anno fondazione mancante');
  if (!data.advanced.formaGiuridica) errors.push('Forma giuridica mancante');
  if (!data.advanced.fatturatoEsatto) errors.push('Fatturato esatto mancante');
  if (!data.advanced.ebitda) errors.push('EBITDA mancante');
  if (!data.advanced.mercatoTarget) errors.push('Mercato target mancante');
  if (data.advanced.competitor.length === 0) errors.push('Competitor mancanti');
  if (!data.advanced.vantaggioCompetitivo) errors.push('Vantaggio competitivo mancante');
  if (data.advanced.obiettiviSpecifici.length === 0) errors.push('Obiettivi specifici mancanti');
  
  return errors;
}
