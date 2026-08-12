// ================================================================
// RACCOLTA DATI AVANZATI - Durante la Call con il Consulente
// ================================================================

import { CompleteBusinessData, validateCompleteData } from './interview-engine';

export class AdvancedDataCollector {
  
  // ============================================================
  // 1. IL CONSULENTE INSERISCE I DATI
  // ============================================================
  async collectDuringCall(
    leadId: string,
    consultantId: string,
    data: Partial<CompleteBusinessData['advanced']>
  ): Promise<{ success: boolean; errors: string[] }> {
    console.log(`📝 Raccolta dati avanzati per lead ${leadId}...`);
    
    // In produzione: salva su Odoo
    // const lead = await odoo.execute('crm.lead', 'write', [[leadId], {
    //   anno_fondazione: data.annoFondazione,
    //   forma_giuridica: data.formaGiuridica,
    //   fatturato_esatto: data.fatturatoEsatto,
    //   ebitda: data.ebitda,
    //   // ... tutti i campi
    // }]);
    
    // Verifica completezza
    const fullData: CompleteBusinessData = {
      basic: await this.getBasicData(leadId),
      advanced: data as CompleteBusinessData['advanced'],
    };
    
    const errors = validateCompleteData(fullData);
    
    if (errors.length > 0) {
      console.log(`⚠️ Dati mancanti: ${errors.join(', ')}`);
      return { success: false, errors };
    }
    
    console.log(`✅ Dati completi raccolti!`);
    return { success: true, errors: [] };
  }
  
  // ============================================================
  // 2. RECUPERA I DATI BASE
  // ============================================================
  private async getBasicData(leadId: string): Promise<any> {
    // In produzione: recupera da Odoo
    // const lead = await odoo.execute('crm.lead', 'read', [[leadId]]);
    // return lead;
    
    // Mock per demo
    return {
      nome: 'Mario Rossi',
      email: 'mario@innovazione.it',
      azienda: 'Innovazione S.r.l.',
      settore: 'Food',
      fatturato: '€3.5M',
      dipendenti: '18',
      tipoProgetto: 'Business Plan base',
      destinatario: 'Banca',
      tempistiche: 'Breve (1-3 mesi)',
      budget: '€5.000 - €10.000',
      obiettivi: 'Espansione nazionale',
    };
  }
}

export const advancedDataCollector = new AdvancedDataCollector();
