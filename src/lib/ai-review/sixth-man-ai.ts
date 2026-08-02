// ================================================================
// SESTO UOMO AI - Sistema Anti-Allucinazione Multi-Modello
// ================================================================

import { aiOrchestrator } from '@/ai/orchestrator';
import { kbManager } from '@/lib/kb/kb-manager';

export interface AIReview {
  id: string;
  originalContent: string;
  reviewedContent: string;
  errors: AIError[];
  confidence: number;
  modelUsed: string;
}

export interface AIError {
  type: 'factual' | 'logical' | 'numerical' | 'contextual' | 'formatting';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
  source: string;
}

export class SixthManAI {
  
  // 1. REVISORE 1: AI GENERATIVA (Claude/Groq)
  async generateContent(prompt: string, context: any): Promise<string> {
    const response = await aiOrchestrator.processRequest({
      type: 'generation',
      data: {
        type: 'business-plan-section',
        prompt,
        context,
        temperature: 0.3,
        maxTokens: 2000,
      },
    });
    return response.result.content || response.result.text || '';
  }

  // 2. REVISORE 2: AI VERIFICATRICE (Modello Diverso - Groq vs Claude)
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

    // Parsing della risposta per estrarre gli errori
    const text = response.result.content || response.result.text || '';
    return this.parseErrors(text);
  }

  // 3. REVISORE 3: AI COMPARATIVA (Confronto con KB)
  async compareWithKB(content: string, kbModule: string): Promise<AIError[]> {
    const kbData = await kbManager.loadPlain(kbModule);
    
    const comparisonPrompt = `
      **RUOLO:** Sei un comparatore di contenuti. Devi confrontare il contenuto generato con la Knowledge Base.

      **CONTENUTO GENERATO:**
      ${content}

      **KNOWLEDGE BASE:**
      ${JSON.stringify(kbData, null, 2)}

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
    return this.parseErrors(text);
  }

  // 4. REVISORE 4: AI SPECIALISTA (Verifica Settoriale)
  async specialistReview(content: string, sector: string): Promise<AIError[]> {
    const specialistPrompt = `
      **RUOLO:** Sei un esperto del settore ${sector}.

      **CONTENUTO DA VERIFICARE:**
      ${content}

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
    return this.parseErrors(text);
  }

  // 5. REVISORE 5: AI AGGREGATORE
  async aggregateReviews(
    originalContent: string,
    allErrors: AIError[][]
  ): Promise<{ correctedContent: string; residualErrors: AIError[] }> {
    // Unisce tutti gli errori trovati
    const uniqueErrors = this.deduplicateErrors(allErrors.flat());

    // Genera il contenuto corretto
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
      4. Aggiungi note sui cambiamenti fatti

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

    // Verifica residual errors (dovrebbero essere quasi zero)
    const residualErrors = await this.verifyContent(correctedContent, {});
    const finalErrors = residualErrors.filter(e => e.severity === 'critical' || e.severity === 'high');

    return {
      correctedContent,
      residualErrors: finalErrors,
    };
  }

  // 6. REVISORE 6: UMANO (solo approvazione finale)
  // Questo viene gestito dal consulente tramite UI

  // === UTILITY ===

  private parseErrors(text: string): AIError[] {
    const errors: AIError[] = [];
    
    // Cerca pattern di errori nel testo
    const errorPatterns = [
      /Tipo:\s*(factual|logical|numerical|contextual|formatting)/i,
      /Gravità:\s*(low|medium|high|critical)/i,
      /Descrizione:\s*([^\n]+)/i,
      /Suggerimento:\s*([^\n]+)/i,
      /Fonte:\s*([^\n]+)/i,
    ];

    // Implementazione semplificata - in produzione si usa parsing più robusto
    // Per ora, estraiamo gli errori dal formato strutturato
    
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

  // === PROCESSO COMPLETO DEL SESTO UOMO AI ===

  async fullReview(
    prompt: string,
    context: any,
    kbModule: string = 'layout-rules',
    sector: string = 'generico'
  ): Promise<{ content: string; errorsFound: number; confidence: number }> {
    // 1. AI Generativa
    const initialContent = await this.generateContent(prompt, context);
    
    // 2. AI Verificatrice
    const verificationErrors = await this.verifyContent(initialContent, context);
    
    // 3. AI Comparativa (KB)
    const kbErrors = await this.compareWithKB(initialContent, kbModule);
    
    // 4. AI Specialist
    const specialistErrors = await this.specialistReview(initialContent, sector);
    
    // 5. AI Aggregatore
    const allErrors = [verificationErrors, kbErrors, specialistErrors];
    const result = await this.aggregateReviews(initialContent, allErrors);
    
    // 6. UMANO → approvazione finale (fuori da questo processo)

    return {
      content: result.correctedContent,
      errorsFound: allErrors.flat().length,
      confidence: result.residualErrors.length === 0 ? 0.99 : 0.95 - (result.residualErrors.length * 0.01),
    };
  }
}

export const sixthManAI = new SixthManAI();
