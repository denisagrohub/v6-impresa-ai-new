// ================================================================
// INTERVIEW LOADER - Carica l'intervista dalle KB
// ================================================================

import { kbManager } from '@/lib/kb/kb-manager';
import fs from 'fs/promises';
import path from 'path';

export interface InterviewQuestion {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'number';
  placeholder?: string;
  options?: string[];
  required: boolean;
  order: number;
  phase?: 'basic' | 'advanced';
}

export interface InterviewPhase {
  id: string;
  name: string;
  icon: string;
  description: string;
  questions: InterviewQuestion[];
}

export class InterviewLoader {
  private basePath: string;

  constructor() {
    this.basePath = path.join(process.cwd(), 'src/data/kb/intervista');
  }

  // ============================================================
  // 1. CARICA TUTTE LE FASI
  // ============================================================
  async loadAllPhases(): Promise<InterviewPhase[]> {
    const phases: InterviewPhase[] = [];
    const phaseFiles = ['fase-1-profile', 'fase-2-project', 'fase-3-financial', 'fase-4-market'];
    
    for (const fileName of phaseFiles) {
      const filePath = path.join(this.basePath, 'fasi', `${fileName}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const phase = JSON.parse(content);
      phases.push(phase);
    }
    
    return phases;
  }

  // ============================================================
  // 2. CARICA UNA FASE SPECIFICA
  // ============================================================
  async loadPhase(phaseId: string): Promise<InterviewPhase | null> {
    try {
      const filePath = path.join(this.basePath, 'fasi', `${phaseId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  // ============================================================
  // 3. CARICA DOMANDE EXTRA PER PACCHETTO
  // ============================================================
  async loadPackageVariants(packageId: string): Promise<InterviewQuestion[]> {
    try {
      const filePath = path.join(this.basePath, 'varianti/by-package', `${packageId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.additionalQuestions || [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // 4. CARICA DOMANDE EXTRA PER SETTORE
  // ============================================================
  async loadSectorVariants(sector: string): Promise<InterviewQuestion[]> {
    try {
      const filePath = path.join(this.basePath, 'varianti/by-sector', `${sector}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.additionalQuestions || [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // 5. CARICA TEMPLATE CALL
  // ============================================================
  async loadCallTemplate(templateType: string): Promise<any> {
    try {
      const filePath = path.join(this.basePath, 'templates', `${templateType}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  // ============================================================
  // 6. COSTRUISCI INTERVISTA COMPLETA PER PACCHETTO
  // ============================================================
  async buildInterview(packageId: string, sector?: string): Promise<{
    phases: InterviewPhase[];
    totalQuestions: number;
    estimatedTime: number;
  }> {
    // Carica le fasi base
    const phases = await this.loadAllPhases();
    
    // Carica le varianti per pacchetto
    const packageVariants = await this.loadPackageVariants(packageId);
    
    // Carica le varianti per settore (se fornito)
    const sectorVariants = sector ? await this.loadSectorVariants(sector) : [];
    
    // Aggiungi le domande extra alla fase appropriata (o crea una nuova fase)
    if (packageVariants.length > 0 || sectorVariants.length > 0) {
      // Aggiungi una fase "advanced" con le domande extra
      const advancedPhase: InterviewPhase = {
        id: 'fase-advanced',
        name: 'Dati Aggiuntivi',
        icon: 'FileText',
        description: 'Alcune domande aggiuntive per il tuo pacchetto',
        questions: [...packageVariants, ...sectorVariants],
      };
      phases.push(advancedPhase);
    }
    
    const totalQuestions = phases.reduce((acc, p) => acc + p.questions.length, 0);
    const estimatedTime = Math.ceil(totalQuestions * 0.6); // ~36 secondi per domanda
    
    return { phases, totalQuestions, estimatedTime };
  }

  // ============================================================
  // 7. AGGIORNA METRICHE
  // ============================================================
  async updateMetrics(questionId: string, success: boolean, time: number): Promise<void> {
    const metricsPath = path.join(this.basePath, 'metrics', 'performance.json');
    const content = await fs.readFile(metricsPath, 'utf-8');
    const metrics = JSON.parse(content);
    
    // Aggiorna metriche
    if (!metrics.metrics.questionPerformance[questionId]) {
      metrics.metrics.questionPerformance[questionId] = { attempts: 0, successes: 0, totalTime: 0 };
    }
    
    metrics.metrics.questionPerformance[questionId].attempts++;
    if (success) metrics.metrics.questionPerformance[questionId].successes++;
    metrics.metrics.questionPerformance[questionId].totalTime += time;
    
    // Salva
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  }
}

export const interviewLoader = new InterviewLoader();
