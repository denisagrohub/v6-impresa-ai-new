import { BPData, BPGenerationResult, BPSection } from './types';
import { sixthManIterative } from '@/lib/ai-review/sixth-man-iterative';

export class BPIterativeEngine {
  async generate(data: BPData): Promise<BPGenerationResult> {
    const prompts = this.buildPrompts(data);
    const sections: BPSection[] = [];

    for (const [key, prompt] of Object.entries(prompts)) {
      console.log(`📝 Generazione sezione: ${key}`);
      
      const result = await sixthManIterative.fullIterativeReview(
        prompt,
        data,
        'layout-rules',
        data.sector
      );

      console.log(`   Iterazioni: ${result.iterations}, Errori: ${result.errorsFound.join(' → ')}`);
      console.log(`   Consenso unanime: ${result.consensusReached ? '✅ SÌ' : '❌ NO'}`);
      console.log(`   Confidenza: ${Math.round(result.finalConfidence * 100)}%`);

      sections.push({
        id: key,
        title: this.getSectionTitle(key),
        content: result.content,
        order: Object.keys(prompts).indexOf(key),
        aiGenerated: true,
      });
    }

    return {
      id: `BP-${Date.now()}`,
      title: `${data.companyName} - Business Plan V6`,
      packageId: data.packageId,
      packageLevel: data.packageLevel,
      audience: data.audience,
      sections,
      summary: this.buildSummary(sections, data),
      price: this.calculatePrice(data),
      estimatedDelivery: this.calculateDelivery(data),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private buildPrompts(data: BPData): Record<string, string> {
    return {
      executiveSummary: `...`,
      companyDescription: `...`,
      marketAnalysis: `...`,
      financialProjections: `...`,
      riskAssessment: `...`,
    };
  }

  private getSectionTitle(key: string): string {
    const titles: Record<string, string> = {
      executiveSummary: 'Executive Summary',
      companyDescription: 'Descrizione dell\'Azienda',
      marketAnalysis: 'Analisi di Mercato',
      financialProjections: 'Proiezioni Finanziarie',
      riskAssessment: 'Analisi dei Rischi',
    };
    return titles[key] || key;
  }

  private buildSummary(sections: BPSection[], data: BPData): string {
    const executiveSummary = sections.find(s => s.id === 'executiveSummary');
    if (executiveSummary) {
      const firstParagraph = executiveSummary.content.split('\n\n')[0];
      return firstParagraph.length > 500 ? firstParagraph.substring(0, 500) + '...' : firstParagraph;
    }
    return `${data.companyName} - Business Plan V6 per ${data.audience}.`;
  }

  private calculatePrice(data: BPData): number {
    const priceMap: Record<string, number> = {
      base: 3000,
      starter: 5500,
      premium: 10000,
      executive: 18000,
      custom: 50000,
    };
    return priceMap[data.packageId] || 3000;
  }

  private calculateDelivery(data: BPData): string {
    const deliveryMap: Record<string, string> = {
      base: '48 ore',
      starter: '5 giorni',
      premium: '7 giorni',
      executive: '10 giorni',
      custom: 'Da definire',
    };
    return deliveryMap[data.packageId] || '5 giorni';
  }
}
