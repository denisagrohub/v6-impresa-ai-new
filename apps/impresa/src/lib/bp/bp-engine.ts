import { BPData, BPGenerationResult, BPSection, AudienceType, PackageLevel, PackageId } from './types';
import { kbManager } from '@/lib/kb/kb-manager';
import { aiOrchestrator } from '@/ai/orchestrator';

export class BPEngine {
  async generate(data: BPData): Promise<BPGenerationResult> {
    // 1. Carica le KB appropriate
    const kbContext = await this.loadKBContext(data);

    // 2. Costruisci i prompt per l'AI
    const prompts = this.buildPrompts(data, kbContext);

    // 3. Genera le sezioni con l'AI
    const sections = await this.generateSections(prompts, data);

    // 4. Genera il riassunto
    const summary = await this.generateSummary(sections, data);

    return {
      id: `BP-${Date.now()}`,
      title: `${data.companyName} - Business Plan V6`,
      packageId: data.packageId,
      packageLevel: data.packageLevel,
      audience: data.audience,
      sections,
      summary,
      price: this.calculatePrice(data),
      estimatedDelivery: this.calculateDelivery(data),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async loadKBContext(data: BPData): Promise<any> {
    const kb = await kbManager.loadPlain('layout-rules');
    const psychology = await kbManager.loadEncrypted('psychology-DISC');
    return { ...kb, psychology };
  }

  private buildPrompts(data: BPData, kbContext: any): Record<string, string> {
    const audienceMap: Record<AudienceType, string> = {
      bank: 'formale, con enfasi su garanzie e flussi di cassa',
      investor: 'persuasivo, con enfasi su crescita e exit strategy',
      partner: 'collaborativo, con enfasi su sinergie',
      internal: 'operativo, con enfasi su KPI e azioni',
    };

    const packageMap: Record<PackageId, string> = {
      base: 'Business Plan completo con analisi finanziaria base',
      starter: 'Business Plan + Analisi di settore approfondita',
      premium: 'Business Plan + Brand Analysis + Marketing Plan',
      executive: 'Premium + Workshop strategico + Supporto 1 anno',
      custom: 'Progetto completamente personalizzato',
    };

    return {
      executiveSummary: `
        Genera un Executive Summary per ${data.companyName} (${data.sector}).
        Destinatario: ${data.audience}. Pacchetto: ${packageMap[data.packageId]}.
        Obiettivi: ${data.objectives.join(', ')}.
        Tono: ${audienceMap[data.audience]}.
        Lunghezza: 1-2 pagine.
      `,
      companyDescription: `
        Descrivi l'azienda ${data.companyName}. Settore: ${data.sector}.
        ${data.foundingYear ? `Fondata nel ${data.foundingYear}.` : ''}
        ${data.employees ? `Dipendenti: ${data.employees}.` : ''}
        Punti di forza e posizionamento.
      `,
      marketAnalysis: `
        Analisi di mercato per ${data.companyName} (${data.sector}).
        Mercato target: ${data.marketSize || 'da definire'}.
        Competitor: ${data.competitors?.join(', ') || 'da analizzare'}.
        Vantaggio competitivo: ${data.competitiveAdvantage || 'da definire'}.
        Trend di settore e opportunità.
      `,
      financialProjections: `
        Proiezioni finanziarie per ${data.companyName}.
        ${data.revenue ? `Fatturato attuale: €${data.revenue.toLocaleString()}.` : ''}
        ${data.ebitda ? `EBITDA: €${data.ebitda.toLocaleString()}.` : ''}
        ${data.fundingNeeded ? `Fabbisogno finanziario: €${data.fundingNeeded.toLocaleString()}.` : ''}
        Proiezioni 3-5 anni con scenari (base, ottimistico, pessimistico).
      `,
      riskAssessment: `
        Analisi dei rischi per ${data.companyName}.
        Identifica rischi finanziari, operativi, di mercato e normativi.
        Propone mitigazioni.
      `,
    };
  }

  private async generateSections(prompts: Record<string, string>, data: BPData): Promise<BPSection[]> {
    const sectionOrder = this.getSectionOrder(data.audience);
    const sections: BPSection[] = [];

    for (const [key, prompt] of Object.entries(prompts)) {
      const aiResponse = await aiOrchestrator.processRequest({
        type: 'generation',
        data: {
          type: 'business-plan-section',
          prompt,
          context: data,
        },
      });

      sections.push({
        id: key,
        title: this.getSectionTitle(key),
        content: aiResponse.result.content || aiResponse.result.text || 'Contenuto generato',
        order: sectionOrder.indexOf(key),
        aiGenerated: true,
      });
    }

    return sections;
  }

  private getSectionOrder(audience: AudienceType): string[] {
    const base = ['executiveSummary', 'companyDescription', 'marketAnalysis', 'financialProjections', 'riskAssessment'];
    if (audience === 'bank') {
      return ['executiveSummary', 'companyDescription', 'financialProjections', 'marketAnalysis', 'riskAssessment'];
    } else if (audience === 'investor') {
      return ['executiveSummary', 'marketAnalysis', 'companyDescription', 'financialProjections', 'riskAssessment'];
    }
    return base;
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

  private async generateSummary(sections: BPSection[], data: BPData): Promise<string> {
    const executiveSummary = sections.find(s => s.id === 'executiveSummary');
    if (executiveSummary) {
      return executiveSummary.content.substring(0, 500) + '...';
    }
    return `${data.companyName} - Business Plan V6 per ${data.audience}.`;
  }

  private calculatePrice(data: BPData): number {
    const priceMap: Record<PackageId, number> = {
      base: 3000,
      starter: 5500,
      premium: 10000,
      executive: 18000,
      custom: 50000,
    };
    return priceMap[data.packageId] || 3000;
  }

  private calculateDelivery(data: BPData): string {
    const deliveryMap: Record<PackageId, string> = {
      base: '48 ore',
      starter: '5 giorni',
      premium: '7 giorni',
      executive: '10 giorni',
      custom: 'Da definire',
    };
    return deliveryMap[data.packageId] || '5 giorni';
  }
}

export const bpEngine = new BPEngine();
