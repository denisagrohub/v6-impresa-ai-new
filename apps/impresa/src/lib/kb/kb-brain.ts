// ================================================================
// KB BRAIN - Manager delle Knowledge Base come Cervello
// ================================================================

import fs from 'fs/promises';
import path from 'path';

export interface KBEntry {
  id: string;
  type: 'conoscenza' | 'errore' | 'apprendimento';
  category: string;
  content: any;
  metadata: {
    createdAt: string;
    updatedAt: string;
    source: 'ai' | 'umano' | 'sistema' | 'cliente';
    tags: string[];
    confidence: number;
  };
}

export interface AIInteraction {
  timestamp: string;
  prompt: string;
  response: string;
  errors: any[];
  corrections: any[];
  success: boolean;
  modelUsed: string;
}

interface KBStats {
  conoscenza: { entries: number; lastUpdated: string | null };
  errori: { entries: number; lastUpdated: string | null };
  apprendimento: { entries: number; lastUpdated: string | null };
  meta: { entries: number; lastUpdated: string | null };
  totale: number;
}

export class KBBrain {
  private basePath: string;
  private cache: Map<string, any>;

  constructor() {
    this.basePath = path.join(process.cwd(), 'src/data/kb');
    this.cache = new Map();
  }

  // ============================================================
  // 1. REGISTRAZIONE AUTOMATICA DI TUTTE LE INTERAZIONI AI
  // ============================================================
  async registerAIInteraction(interaction: AIInteraction): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.basePath, 'meta', `interaction_${timestamp}.json`);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(interaction, null, 2));
    
    await this.learnFromInteraction(interaction);
  }

  // ============================================================
  // 2. APPRENDIMENTO DA INTERAZIONI
  // ============================================================
  private async learnFromInteraction(interaction: AIInteraction): Promise<void> {
    if (interaction.errors && interaction.errors.length > 0) {
      await this.registerErrors(interaction);
    }
    if (interaction.success) {
      await this.registerSuccess(interaction);
    }
    if (interaction.corrections && interaction.corrections.length > 0) {
      await this.registerCorrections(interaction);
    }
  }

  // ============================================================
  // 3. REGISTRA ERRORI NELLA KB DEGLI ERRORI
  // ============================================================
  private async registerErrors(interaction: AIInteraction): Promise<void> {
    const errorsPath = path.join(this.basePath, 'errori', 'registrati');
    await fs.mkdir(errorsPath, { recursive: true });

    for (const error of interaction.errors) {
      const errorEntry = {
        id: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: 'errore' as const,
        category: error.type || 'sconosciuto',
        content: {
          pattern: error.description,
          severity: error.severity || 'medium',
          fix: error.suggestion || 'Da analizzare',
          example: error.source || 'N/A',
          context: {
            prompt: interaction.prompt,
            model: interaction.modelUsed,
            timestamp: interaction.timestamp,
          },
        },
        metadata: {
          createdAt: interaction.timestamp,
          updatedAt: interaction.timestamp,
          source: 'ai' as const,
          tags: [error.type || 'unknown', error.severity || 'medium'],
          confidence: 1.0,
        },
      };

      const filePath = path.join(errorsPath, `${errorEntry.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(errorEntry, null, 2));
    }
  }

  // ============================================================
  // 4. REGISTRA SUCCESSI PER MIGLIORARE I TEMPLATE
  // ============================================================
  private async registerSuccess(interaction: AIInteraction): Promise<void> {
    const successPath = path.join(this.basePath, 'apprendimento', 'successi');
    await fs.mkdir(successPath, { recursive: true });

    const successEntry = {
      id: `SUC-${Date.now()}`,
      type: 'apprendimento' as const,
      category: 'successo',
      content: {
        prompt: interaction.prompt,
        response: interaction.response,
        pattern: this.extractSuccessPattern(interaction.response),
      },
      metadata: {
        createdAt: interaction.timestamp,
        updatedAt: interaction.timestamp,
        source: 'ai' as const,
        tags: ['successo', 'template'],
        confidence: 0.9,
      },
    };

    const filePath = path.join(successPath, `${successEntry.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(successEntry, null, 2));
  }

  // ============================================================
  // 5. REGISTRA CORREZIONI UMANE COME REGOLE
  // ============================================================
  private async registerCorrections(interaction: AIInteraction): Promise<void> {
    const correctionsPath = path.join(this.basePath, 'apprendimento', 'correzioni');
    await fs.mkdir(correctionsPath, { recursive: true });

    for (const correction of interaction.corrections) {
      const correctionEntry = {
        id: `COR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: 'apprendimento' as const,
        category: 'correzione_umana',
        content: {
          original: correction.original,
          corrected: correction.corrected,
          reason: correction.reason || 'Correzione manuale',
          rule: this.extractRule(correction.original, correction.corrected),
        },
        metadata: {
          createdAt: interaction.timestamp,
          updatedAt: interaction.timestamp,
          source: 'umano' as const,
          tags: ['correzione', 'regola'],
          confidence: 1.0,
        },
      };

      const filePath = path.join(correctionsPath, `${correctionEntry.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(correctionEntry, null, 2));
    }
  }

  // ============================================================
  // 6. ESTRAZIONE PATTERN DI SUCCESSO
  // ============================================================
  private extractSuccessPattern(response: string): string {
    return 'Pattern identificato: ' + response.substring(0, 100) + '...';
  }

  // ============================================================
  // 7. ESTRAZIONE REGOLE DA CORREZIONI
  // ============================================================
  private extractRule(original: string, corrected: string): string {
    if (original.includes('€') && corrected.includes('[DA DEFINIRE]')) {
      return 'NON inventare numeri. Usa placeholder [DA DEFINIRE]';
    }
    if (original.length > corrected.length * 1.5) {
      return 'Riduci la lunghezza. Sii più conciso.';
    }
    return 'Regola da definire manualmente';
  }

  // ============================================================
  // 8. RICERCA NELLE KB (per RAG)
  // ============================================================
  async search(query: string, type?: 'conoscenza' | 'errore' | 'apprendimento'): Promise<any[]> {
    const results: any[] = [];
    const searchPaths = type ? [path.join(this.basePath, type)] : 
      ['conoscenza', 'errori', 'apprendimento'].map(t => path.join(this.basePath, t));

    for (const searchPath of searchPaths) {
      if (!await this.exists(searchPath)) continue;
      const files = await fs.readdir(searchPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(searchPath, file), 'utf-8');
          const entry = JSON.parse(content);
          if (JSON.stringify(entry).toLowerCase().includes(query.toLowerCase())) {
            results.push(entry);
          }
        }
      }
    }

    return results;
  }

  // ============================================================
  // 9. STATISTICHE DELLE KB
  // ============================================================
  async getStats(): Promise<KBStats> {
    const stats: KBStats = {
      conoscenza: { entries: 0, lastUpdated: null },
      errori: { entries: 0, lastUpdated: null },
      apprendimento: { entries: 0, lastUpdated: null },
      meta: { entries: 0, lastUpdated: null },
      totale: 0,
    };

    const types = ['conoscenza', 'errori', 'apprendimento', 'meta'] as const;
    for (const type of types) {
      const typePath = path.join(this.basePath, type);
      if (await this.exists(typePath)) {
        const entries = await fs.readdir(typePath);
        const jsonFiles = entries.filter(f => f.endsWith('.json'));
        stats[type].entries = jsonFiles.length;
        if (jsonFiles.length > 0) {
          const lastFile = jsonFiles.sort().pop();
          if (lastFile) {
            const stat = await fs.stat(path.join(typePath, lastFile));
            stats[type].lastUpdated = stat.mtime.toISOString();
          }
        }
        stats.totale += jsonFiles.length;
      }
    }

    return stats;
  }

  // ============================================================
  // 10. UTILITY
  // ============================================================
  private async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

export const kbBrain = new KBBrain();
