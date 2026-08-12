// ================================================================
// SESTO UOMO ITERATIVO - Ciclo fino a Convergenza Unanime
// ================================================================

import { aiOrchestrator } from '@/ai/orchestrator';
import { kbManager } from '@/lib/kb/kb-manager';

export interface IterativeReviewResult {
  content: string;
  iterations: number;
  errorsFound: number[];
  finalConfidence: number;
  consensusReached: boolean;
  history: IterationHistory[];
}

export interface IterationHistory {
  iteration: number;
  errorsFound: number;
  content: string;
  reviewers: {
    id: string;
    errors: AIError[];
    satisfied: boolean;
  }[];
}

export interface AIError {
  type: 'factual' | 'logical' | 'numerical' | 'contextual' | 'formatting';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
  source: string;
}

export class SixthManIterative {
  private MAX_ITERATIONS = 10; // Massimo 10 iterazioni per evitare loop infiniti
  private CONVERGENCE_THRESHOLD = 0; // Zero errori per convergenza

  // ============================================================
  // REVISORE 1: AI GENERATIVA (Claude/Groq)
  // ============================================================
  async generateContent(prompt: string, context: any, feedback?: string): Promise<string> {
    const enhancedPrompt = feedback 
      ? `${prompt}\n\n**FEEDBACK PRECEDENTE:**\n${feedback}\n\nGenera il contenuto corretto tenendo conto del feedback.`
      : prompt;

    const response = await aiOrchestrator.processRequest({
      type: 'generation',
      data: {
        type: 'business-plan-section',
        prompt: enhancedPrompt,
        context,
        temperature: 0.3,
        maxTokens: 2000,
      },
    });
    return response.result.content || response.result.text || '';
  }

  // ============================================================
  // REVISORE 2: AI VERIFICATRICE (Modello Diverso)
  // ============================================================
  async verifyContent(content: string, context: any): Promise<AIError[]> {
    const verificationPrompt = `
      **RUOLO:** Sei un verificatore di fatti e dati. Devi controllare il seguente contenuto per errori.

      **CONTENUTO DA VERIFICARE:**
      ${content}

      **CONTESTO:**
      ${JSON.stringify(context, null, 2)}

      **REGOLE DI VERIFICA:**
      1. Verifica che tutti i fatti siano supportati dai dati forniti
      2. Verifica che i numeri siano coerenti
      3. Verifica che non ci siano contraddizioni logiche
      4. Verifica che non ci siano affermazioni non supportate
      5. Verifica che il tono sia appropriato

      **SE NON TROVI ERRORI**, rispondi con: "NESSUN ERRORE TROVATO"

      **FORMATO RISPOSTA:**
      Elenca ogni errore trovato con:
      - Tipo: factual | logical | numerical | contextual | formatting
      - Gravità: low | medium | high | critical
      - Descrizione: spiegazione dell'errore
      - Suggerimento: come correggerlo
      - Fonte: quale parte del contenuto contiene l'errore
    `;

    const response = await aiOrchestrator.processRequest({
      type: 'analysis',
      data: {
        type: 'verification',
        prompt: verificationPrompt,
        content,
        context,
        temperature: 0.2,
        maxTokens: 1500,
      },
    });

    const text = response.result.content || response.result.text || '';
    
    // Se il verificatore dice che non ci sono errori, restituisci array vuoto
    if (text.toUpperCase().includes('NESSUN ERRORE TROVATO')) {
      return [];
    }

    return this.parseErrors(text);
  }

  // ============================================================
  // REVISORE 3: AI COMPARATIVA (con KB)
  // ============================================================
  async compareWithKB(content: string, kbModule: string): Promise<AIError[]> {
    const kbData = await kbManager.loadPlain(kbModule);
    
    const comparisonPrompt = `
      **RUOLO:** Sei un comparatore di contenuti. Devi confrontare il contenuto generato con la Knowledge Base.

      **CONTENUTO GENERATO:**
      ${content}

      **KNOWLEDGE BASE:**
      ${JSON.stringify(kbData, null, 2)}

      **SE NON TROVI DISCREPANZE**, rispondi con: "NESSUNA DISCREPANZA TROVATA"

      **REGOLE:**
      1. Verifica che il contenuto sia allineato con la KB
      2. Segnala discrepanze
      3. Segnala informazioni mancanti
      4. Segnala informazioni non supportate dalla KB

      **FORMATO RISPOSTA:**
      Elenca ogni discrepanza con:
      - Tipo: factual | contextual
      - Gravità: low | medium | high | critical
      - Descrizione: cosa non corrisponde
      - Suggerimento: come allineare alla KB
    `;

    const response = await aiOrchestrator.processRequest({
      type: 'analysis',
      data: {
        type: 'kb_comparison',
        prompt: comparisonPrompt,
        content,
        kbData,
        temperature: 0.2,
        maxTokens: 1500,
      },
    });

    const text = response.result.content || response.result.text || '';
    
    if (text.toUpperCase().includes('NESSUNA DISCREPANZA TROVATA')) {
      return [];
    }

    return this.parseErrors(text);
  }

  // ============================================================
  // REVISORE 4: AI SPECIALISTA (Settoriale)
  // ============================================================
  async specialistReview(content: string, sector: string): Promise<AIError[]> {
    const specialistPrompt = `
      **RUOLO:** Sei un esperto del settore ${sector}.

      **CONTENUTO DA VERIFICARE:**
      ${content}

      **SE NON TROVI ERRORI**, rispondi con: "NESSUN ERRORE DI SETTORE TROVATO"

      **REGOLE:**
      1. Verifica che l'analisi di settore sia corretta
      2. Verifica che i trend siano attuali
      3. Verifica che i competitor siano corretti
      4. Verifica che le proiezioni siano realistiche

      **FORMATO RISPOSTA:**
      Elenca ogni errore con:
      - Tipo: factual | numerical | contextual
      - Gravità: low | medium | high | critical
      - Descrizione: errore specifico del settore
      - Suggerimento: correzione
    `;

    const response = await aiOrchestrator.processRequest({
      type: 'analysis',
      data: {
        type: 'specialist_review',
        prompt: specialistPrompt,
        content,
        sector,
        temperature: 0.2,
        maxTokens: 1500,
      },
    });

    const text = response.result.content || response.result.text || '';
    
    if (text.toUpperCase().includes('NESSUN ERRORE DI SETTORE TROVATO')) {
      return [];
    }

    return this.parseErrors(text);
  }

  // ============================================================
  // REVISORE 5: AI AGGREGATORE
  // ============================================================
  async aggregateReviews(
    originalContent: string,
    allErrors: AIError[][]
  ): Promise<{ correctedContent: string; residualErrors: AIError[] }> {
    // Unisce tutti gli errori (deduplica)
    const uniqueErrors = this.deduplicateErrors(allErrors.flat());

    if (uniqueErrors.length === 0) {
      return {
        correctedContent: originalContent,
        residualErrors: [],
      };
    }

    const correctionPrompt = `
      **RUOLO:** Sei un aggregatore e correttore di contenuti.

      **CONTENUTO ORIGINALE:**
      ${originalContent}

      **ERRORI TROVATI:**
      ${JSON.stringify(uniqueErrors, null, 2)}

      **REGOLE:**
      1. Correggi TUTTI gli errori elencati
      2. Mantieni lo stile e il tono originale
      3. Non introdurre nuovi errori

      **FORMATO RISPOSTA:**
      Fornisci il contenuto completo corretto.
    `;

    const response = await aiOrchestrator.processRequest({
      type: 'generation',
      data: {
        type: 'correction',
        prompt: correctionPrompt,
        originalContent,
        errors: uniqueErrors,
        temperature: 0.2,
        maxTokens: 3000,
      },
    });

    const correctedContent = response.result.content || response.result.text || originalContent;

    // Verifica residual errors
    const residualErrors = await this.verifyContent(correctedContent, {});
    const finalErrors = residualErrors.filter(e => 
      e.severity === 'critical' || e.severity === 'high'
    );

    return {
      correctedContent,
      residualErrors: finalErrors,
    };
  }

  // ============================================================
  // REVISORE 6: VERIFICA UNANIMITÀ (Consenso)
  // ============================================================
  async checkConsensus(
    content: string,
    context: any,
    kbModule: string,
    sector: string
  ): Promise<{ unanimous: boolean; errors: AIError[] }> {
    // Tutti i revisori controllano indipendentemente
    const [verificationErrors, kbErrors, specialistErrors] = await Promise.all([
      this.verifyContent(content, context),
      this.compareWithKB(content, kbModule),
      this.specialistReview(content, sector),
    ]);

    // Se TUTTI dicono che non ci sono errori → consenso unanime
    const totalErrors = [...verificationErrors, ...kbErrors, ...specialistErrors];
    
    return {
      unanimous: totalErrors.length === 0,
      errors: totalErrors,
    };
  }

  // ============================================================
  // PROCESSO PRINCIPALE: CICLO ITERATIVO FINO A CONSENSO
  // ============================================================
  async fullIterativeReview(
    prompt: string,
    context: any,
    kbModule: string = 'layout-rules',
    sector: string = 'generico'
  ): Promise<IterativeReviewResult> {
    const history: IterationHistory[] = [];
    let currentContent = '';
    let iteration = 0;
    let errorsFound: number[] = [];
    let consensusReached = false;

    console.log(`🧠 Avvio Sesto Uomo Iterativo (max ${this.MAX_ITERATIONS} iterazioni)`);

    while (iteration < this.MAX_ITERATIONS && !consensusReached) {
      iteration++;
      console.log(`\n🔄 ITERAZIONE ${iteration}`);

      // 1. GENERA (o rigenera con feedback)
      const feedback = history.length > 0 
        ? this.buildFeedback(history[history.length - 1])
        : undefined;
      
      currentContent = await this.generateContent(prompt, context, feedback);

      // 2. TUTTI I REVISORI verificano INDIPENDENTEMENTE
      const [verificationErrors, kbErrors, specialistErrors] = await Promise.all([
        this.verifyContent(currentContent, context),
        this.compareWithKB(currentContent, kbModule),
        this.specialistReview(currentContent, sector),
      ]);

      const allErrors = [...verificationErrors, ...kbErrors, ...specialistErrors];
      const errorCount = allErrors.length;
      errorsFound.push(errorCount);

      console.log(`   Errori trovati: ${errorCount}`);

      // 3. REGISTRA STORIA
      history.push({
        iteration,
        errorsFound: errorCount,
        content: currentContent,
        reviewers: [
          { id: 'AI_Verificatrice', errors: verificationErrors, satisfied: verificationErrors.length === 0 },
          { id: 'AI_Comparativa', errors: kbErrors, satisfied: kbErrors.length === 0 },
          { id: 'AI_Specialista', errors: specialistErrors, satisfied: specialistErrors.length === 0 },
        ],
      });

      // 4. VERIFICA CONSENSO UNANIME
      if (errorCount === 0) {
        console.log(`✅ ITERAZIONE ${iteration}: TUTTI I REVISORI SONO UN'ANIMA!`);
        consensusReached = true;
        break;
      }

      // 5. SE CI SONO ERRORI → AGGREGATORE CORREGGE (prepara prossima iterazione)
      if (errorCount > 0 && iteration < this.MAX_ITERATIONS) {
        console.log(`   Correzione in corso per prossima iterazione...`);
        const aggregated = await this.aggregateReviews(currentContent, [
          verificationErrors,
          kbErrors,
          specialistErrors,
        ]);
        
        // Usa il contenuto corretto come base per la prossima iterazione
        // Il feedback viene passato al generatore
        currentContent = aggregated.correctedContent;
      }
    }

    // Calcola confidenza finale
    const finalConfidence = consensusReached 
      ? 0.99 
      : Math.max(0.85, 0.95 - (errorsFound[errorsFound.length - 1] || 0) * 0.02);

    return {
      content: currentContent,
      iterations: iteration,
      errorsFound,
      finalConfidence,
      consensusReached,
      history,
    };
  }

  // ============================================================
  // UTILITY
  // ============================================================

  private parseErrors(text: string): AIError[] {
    const errors: AIError[] = [];
    
    // Cerca pattern di errori nel testo
    const lines = text.split('\n');
    let currentError: Partial<AIError> = {};
    
    for (const line of lines) {
      if (line.includes('Tipo:')) {
        if (currentError.description) {
          errors.push(currentError as AIError);
        }
        currentError = {};
        const match = line.match(/Tipo:\s*(\w+)/i);
        if (match) currentError.type = match[1] as AIError['type'];
      }
      if (line.includes('Gravità:')) {
        const match = line.match(/Gravità:\s*(\w+)/i);
        if (match) currentError.severity = match[1] as AIError['severity'];
      }
      if (line.includes('Descrizione:')) {
        const match = line.match(/Descrizione:\s*(.+)/i);
        if (match) currentError.description = match[1].trim();
      }
      if (line.includes('Suggerimento:')) {
        const match = line.match(/Suggerimento:\s*(.+)/i);
        if (match) currentError.suggestion = match[1].trim();
      }
      if (line.includes('Fonte:')) {
        const match = line.match(/Fonte:\s*(.+)/i);
        if (match) currentError.source = match[1].trim();
      }
    }

    if (currentError.description) {
      errors.push(currentError as AIError);
    }

    return errors;
  }

  private deduplicateErrors(errors: AIError[]): AIError[] {
    const seen = new Set();
    return errors.filter(error => {
      const key = `${error.type}-${error.description}-${error.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildFeedback(history: IterationHistory): string {
    const errors = history.reviewers.flatMap(r => r.errors);
    if (errors.length === 0) return '';
    
    return errors.map(e => 
      `- [${e.severity}] ${e.description} → Suggerimento: ${e.suggestion}`
    ).join('\n');
  }
}

export const sixthManIterative = new SixthManIterative();
