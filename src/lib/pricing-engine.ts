export interface PricingConfig {
    base: number;
    pesoImporto: number; // es. 0.02 (2%)
    pesoComplessita: number; // es. 20000
    pesoUrgenza: number; // es. 1.2 (20% extra)
    settoriComplessi: string[];
}

export interface PricingInput {
    fatturato: string;
    importoOperazione: string;
    settore: string;
    tempistica: string;
    complessita: 'bassa' | 'media' | 'alta';
}

export interface PricingResult {
    stimaMin: number;
    stimaMax: number;
    breakdown: {
        base: number;
        importoComponent: number;
        complessitaComponent: number;
        urgenzaComponent: number;
    };
}

// Configurazione di default (verrà caricata dal backend)
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
    base: 50000,
    pesoImporto: 0.015, // 1.5% dell'importo operazione
    pesoComplessita: 25000,
    pesoUrgenza: 1.25,
    settoriComplessi: ['m&a', 'ristrutturazione debito', 'acquisizione', 'fusione', 'ipo'],
};

export function calcolaPrezzoL3(
    input: PricingInput,
    config: PricingConfig = DEFAULT_PRICING_CONFIG
): PricingResult {
    // 1. Base fissa
    const base = config.base;

    // 2. Componente Importo Operazione (la più importante)
    const importoOp = parseInt(input.importoOperazione.replace(/[^0-9]/g, '')) || 0;
    const importoComponent = importoOp * config.pesoImporto;

    // 3. Componente Complessità
    let complessitaScore = 0;

    // Complessità basata sul settore
    if (config.settoriComplessi.some(s => input.settore.toLowerCase().includes(s))) {
        complessitaScore += 1;
    }

    // Complessità basata su cosa richiede
    if (input.complessita === 'alta') complessitaScore += 2;
    else if (input.complessita === 'media') complessitaScore += 1;

    const complessitaComponent = complessitaScore * config.pesoComplessita;

    // 4. Componente Urgenza
    let urgenzaMultiplier = 1;
    if (input.tempistica === 'immediata') {
        urgenzaMultiplier = config.pesoUrgenza;
    }

    // Calcolo totale
    const totaleBase = base + importoComponent + complessitaComponent;
    const totaleConUrgenza = totaleBase * urgenzaMultiplier;

    // Range di stima (±15% per flessibilità)
    const stimaMin = Math.round(totaleConUrgenza * 0.85);
    const stimaMax = Math.round(totaleConUrgenza * 1.15);

    return {
        stimaMin,
        stimaMax,
        breakdown: {
            base,
            importoComponent: Math.round(importoComponent),
            complessitaComponent: Math.round(complessitaComponent),
            urgenzaComponent: Math.round(totaleBase * (urgenzaMultiplier - 1)),
        },
    };
}
