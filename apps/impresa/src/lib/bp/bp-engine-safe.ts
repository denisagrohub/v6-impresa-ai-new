import { BPData, BPGenerationResult, BPSection } from './types';
import { kbManager } from '@/lib/kb/kb-manager';
import { aiOrchestrator } from '@/ai/orchestrator';

export class BPSafeEngine {
  async generate(data: BPData): Promise<BPGenerationResult> {
    const kbContext = await this.loadKBContext(data);
    const prompts = this.buildSafePrompts(data, kbContext);
    const sections = await this.generateSections(prompts, data);
    const summary = this.buildSummary(sections, data);

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

  private buildSafePrompts(data: BPData, kbContext: any): Record<string, string> {
    const audienceMap: Record<string, string> = {
      bank: 'formale, con enfasi su garanzie e flussi di cassa',
      investor: 'persuasivo, con enfasi su crescita e exit strategy',
      partner: 'collaborativo, con enfasi su sinergie',
      internal: 'operativo, con enfasi su KPI e azioni',
    };

    return {
      // 1. EXECUTIVE SUMMARY - con istruzioni anti-allucinazione
      executiveSummary: `
        **RUOLO:** Sei un consulente strategico senior che scrive un Executive Summary.
        
        **AZIENDA:** ${data.companyName} (Settore: ${data.sector})
        **DESTINATARIO:** ${data.audience}
        **PACCHETTO:** ${data.packageId}
        **OBIETTIVI DEL CLIENTE:** ${data.objectives.join(', ')}
        
        **REGOLE FERREE:**
        1. ✅ USA SOLO le informazioni fornite sopra
        2. ❌ NON INVENTARE numeri, date o fatti
        3. ❌ NON FARE proiezioni ottimistiche senza basi
        4. ✅ Se manca un'informazione, scrivi "[DA DEFINIRE]"
        5. ✅ Sii obiettivo e professionale
        6. ✅ Lunghezza: 250-400 parole
        
        **TONO:** ${audienceMap[data.audience] || 'professionale'}
        
        **FORMATO:**
        1. Paragrafo introduttivo sull'azienda
        2. Contesto e opportunità (basato sui dati forniti)
        3. Proposta di valore
        4. Obiettivi e prossimi passi
      `,

      // 2. DESCRIZIONE AZIENDA - basso rischio
      companyDescription: `
        **RUOLO:** Sei uno scrittore professionale che descrive un'azienda.
        
        **AZIENDA:** ${data.companyName}
        **SETTORE:** ${data.sector}
        ${data.foundingYear ? `**ANNO FONDAZIONE:** ${data.foundingYear}` : ''}
        ${data.employees ? `**DIPENDENTI:** ${data.employees}` : ''}
        ${data.legalForm ? `**FORMA GIURIDICA:** ${data.legalForm}` : ''}
        
        **REGOLE:**
        1. ✅ Usa solo le informazioni fornite
        2. ❌ Non inventare numeri o dati
        3. ✅ Se manca qualcosa, scrivi "[DA DEFINIRE]"
        
        **TONO:** Professionale e descrittivo
      `,

      // 3. ANALISI DI MERCATO - ALTO RISCHIO - con salvaguardie
      marketAnalysis: `
        **RUOLO:** Sei un analista di mercato che scrive un'analisi basata su dati reali.
        
        **AZIENDA:** ${data.companyName}
        **SETTORE:** ${data.sector}
        **MERCATO TARGET:** ${data.marketSize || '[DA DEFINIRE]'}
        **COMPETITOR:** ${data.competitors?.join(', ') || '[DA DEFINIRE - CHIEDERE AL CLIENTE]'}
        **VANTAGGIO COMPETITIVO:** ${data.competitiveAdvantage || '[DA DEFINIRE]'}
        
        **⚠️ ATTENZIONE - REGOLE ANTI-ALLUCINAZIONE:**
        1. ❌ **NON INVENTARE DIMENSIONI DI MERCATO** (TAM, SAM, SOM)
        2. ❌ **NON INVENTARE COMPETITOR** o quote di mercato
        3. ❌ **NON INVENTARE TREND** senza fonti
        4. ✅ Usa solo dati forniti o placeholder "[DA DEFINIRE]"
        5. ✅ Se conosci il settore, menziona trend generali (es. "il settore è in crescita"), ma senza numeri specifici
        6. ✅ Descrivi la logica di analisi, non i numeri
        
        **STRUTTURA:**
        1. Contesto generale del settore (senza numeri inventati)
        2. Mercato target descritto in modo qualitativo
        3. Mappatura competitor (solo quelli forniti)
        4. Vantaggio competitivo (da fornire)
        5. Opportunità di mercato (qualitative)
      `,

      // 4. PROIEZIONI FINANZIARIE - ALTISSIMO RISCHIO - NO AI
      financialProjections: `
        **RUOLO:** Sei un consulente finanziario che descrive il modello finanziario.
        
        **AZIENDA:** ${data.companyName}
        ${data.revenue ? `**FATTURATO ATTUAL E:** €${data.revenue.toLocaleString()}` : '**FATTURATO ATTUALE:** [DA DEFINIRE]'}
        ${data.ebitda ? `**EBITDA:** €${data.ebitda.toLocaleString()}` : '**EBITDA:** [DA DEFINIRE]'}
        ${data.fundingNeeded ? `**FABBISOGNO FINANZIARIO:** €${data.fundingNeeded.toLocaleString()}` : '**FABBISOGNO FINANZIARIO:** [DA DEFINIRE]'}
        
        **⚠️ ATTENZIONE - REGOLE FERREE:**
        1. ❌ **NON GENERARE PROIEZIONI NUMERICHE** - questo è un compito per Excel
        2. ❌ **NON INVENTARE RICAVI, COSTI O MARGINI**
        3. ✅ Descrivi la **metodologia** del modello finanziario
        4. ✅ Spiega **quali driver** saranno utilizzati
        5. ✅ Descrivi gli **scenari** (base, ottimistico, pessimistico) come concetti
        6. ✅ Usa placeholder per i numeri: "[INSERIRE NUMERI DA EXCEL]"
        
        **STRUTTURA:**
        1. Metodologia del modello finanziario
        2. Driver principali (ricavi, costi, investimenti)
        3. Scenari e ipotesi
        4. Indicatori chiave
        5. Nota: "I numeri dettagliati sono disponibili nel modello Excel allegato"
      `,

      // 5. ANALISI DEI RISCHI - medio rischio
      riskAssessment: `
        **RUOLO:** Sei un consulente di risk management.
        
        **AZIENDA:** ${data.companyName}
        **SETTORE:** ${data.sector}
        
        **REGOLE:**
        1. ✅ Identifica rischi **generici** del settore (da KB)
        2. ❌ NON inventare rischi specifici senza basi
        3. ✅ Descrivi le **categorie di rischio** (finanziario, operativo, di mercato, normativo)
        4. ✅ Propone mitigazioni **generiche**
        5. ✅ Usa placeholder per rischi specifici: "[DA DEFINIRE CON IL CLIENTE]"
        
        **STRUTTURA:**
        1. Introduzione alla gestione del rischio
        2. Categorie di rischio per settore
        3. Mitigazioni standard
        4. Prossimi passi: "Si consiglia un workshop di risk assessment con il management"
      `,
    };
  }

  private async generateSections(prompts: Record<string, string>, data: BPData): Promise<BPSection[]> {
    const sectionOrder = ['executiveSummary', 'companyDescription', 'marketAnalysis', 'financialProjections', 'riskAssessment'];
    const sections: BPSection[] = [];

    for (const [key, prompt] of Object.entries(prompts)) {
      try {
        const aiResponse = await aiOrchestrator.processRequest({
          type: 'generation',
          data: {
            type: 'business-plan-section',
            prompt,
            context: data,
            // 🔥 PARAMETRI ANTI-ALLUCINAZIONE
            temperature: 0.3, // Più basso = meno creatività
            maxTokens: 1500,
          },
        });

        let content = aiResponse.result.content || aiResponse.result.text || '';
        
        // 🔥 POST-PROCESSING: rimuovi numeri inventati
        content = this.sanitizeContent(content, key);

        sections.push({
          id: key,
          title: this.getSectionTitle(key),
          content,
          order: sectionOrder.indexOf(key),
          aiGenerated: true,
        });
      } catch (error) {
        // Fallback: contenuto placeholder
        sections.push({
          id: key,
          title: this.getSectionTitle(key),
          content: `[CONTENUTO DA GENERARE - Sezione ${key}]`,
          order: sectionOrder.indexOf(key),
          aiGenerated: false,
        });
      }
    }

    return sections;
  }

  // 🔥 Sanitizzazione: rimuovi numeri inventati
  private sanitizeContent(content: string, sectionType: string): string {
    if (sectionType === 'marketAnalysis') {
      // Rimuovi pattern di numeri inventati (es. "€15M", "12%", "5.2M")
      content = content.replace(/\€?\d+(\.\d+)?[M%]?/g, (match) => {
        // Se sembra un numero inventato, sostituisci con placeholder
        return '[DATI DA VERIFICARE]';
      });
    }
    
    if (sectionType === 'financialProjections') {
      // Rimuovi TUTTI i numeri nelle proiezioni
      content = content.replace(/\d+[.,]?\d*\s*[%€]?/g, (match) => {
        // Se è un numero in una proiezione, sostituisci
        if (match.includes('€') || match.includes('%')) {
          return '[NUMERO DA INSERIRE DA EXCEL]';
        }
        return match;
      });
    }

    // Rimuovi placeholder con doppie parentesi
    content = content.replace(/\[\[.*?\]\]/g, '[DA DEFINIRE]');
    
    return content;
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
      // Prendi solo il primo paragrafo
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

export const bpSafeEngine = new BPSafeEngine();
