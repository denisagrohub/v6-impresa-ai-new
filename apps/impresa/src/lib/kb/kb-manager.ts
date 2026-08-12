// src/lib/kb/kb-manager.ts
// Knowledge Base Manager

export interface KBEntry {
  id: string;
  name: string;
  content: any;
  category?: string;
  tags?: string[];
}

class KBManager {
  private cache: Map<string, any> = new Map();

  async loadPlain(module: string): Promise<any> {
    // Se in cache, restituisci
    if (this.cache.has(`plain_${module}`)) {
      return this.cache.get(`plain_${module}`);
    }

    try {
      // Prova a caricare dal file system
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'src/data/kb/plain', `${module}.json`);
      
      if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.cache.set(`plain_${module}`, content);
        return content;
      }
    } catch (error) {
      console.warn(`⚠️ KB ${module} non trovata, uso fallback`);
    }

    // Fallback: dati mock
    const fallbackData = this.getFallbackData(module);
    this.cache.set(`plain_${module}`, fallbackData);
    return fallbackData;
  }

  async loadEncrypted(module: string): Promise<any> {
    // Versione cifrata - per ora usa loadPlain
    return this.loadPlain(module);
  }

  private getFallbackData(module: string): any {
    const fallbacks: Record<string, any> = {
      'layout-rules': {
        rules: [
          { id: 'R01', name: 'Kairós Separato dallo Score', description: 'Il Kairós si valuta separatamente dallo score.' },
          { id: 'R02', name: 'Pricing come Accesso al Valore', description: 'Il frame precede il numero.' },
        ]
      },
      'psychology-DISC': {
        profiles: [
          { tipo: 'D — DOMINANTE', motivazione: 'Controllo, risultati, velocità' },
          { tipo: 'I — INFLUENTE', motivazione: 'Riconoscimento, relazioni' },
          { tipo: 'S — STABILE', motivazione: 'Stabilità, armonia, sicurezza' },
          { tipo: 'C — COSCIENZIOSO', motivazione: 'Precisione, qualità' },
        ]
      },
      'psychology-PL': {
        patterns: [
          { id: 'PL-01', pattern: 'Uso eccessivo del condizionale', action: 'Aspettare 7-10gg' },
          { id: 'PL-02', pattern: 'Linguaggio "noi" riferito al progetto', action: 'Alimentare visione' },
        ]
      },
      'psychology-PC': {
        patterns: [
          { id: 'PC-01', comportamento: 'Risposta entro 1 ora', action: 'Rispondere con uguale velocità' },
        ]
      },
      'psychology-OB': {
        objections: [
          { id: 'OB-01', dichiarata: '"Costa troppo"', tecnica: 'Ricalibra il valore prima del prezzo' },
        ]
      },
      'method-6areas': {
        aree: [
          { numero: 1, nome: 'Strategia e Visione', domanda: 'Dove vuole andare l\'imprenditore?' },
          { numero: 2, nome: 'Economico-Finanziaria', domanda: 'L\'azienda è sostenibile?' },
        ]
      },
      'rules-universal': {
        regole: [
          { id: 'R01', nome: 'Kairós Separato dallo Score' },
          { id: 'R02', nome: 'Pricing come Accesso al Valore' },
        ]
      },
      'module-c-startup': {
        pilastri: [
          { numero: 1, nome: 'Diagnostica e Founder-Market Fit' },
          { numero: 2, nome: 'Mercato e Validazione' },
        ]
      },
      'commercial-windows': {
        finestre: [
          { id: 'CW-01', serviceName: 'Pianificazione Budget Annuale', mese: 'Settembre-Ottobre' },
          { id: 'CW-02', serviceName: 'Attivazione Budget Approvato', mese: 'Gennaio' },
        ]
      }
    };

    return fallbacks[module] || { data: 'KB non trovata' };
  }
}

export const kbManager = new KBManager();
