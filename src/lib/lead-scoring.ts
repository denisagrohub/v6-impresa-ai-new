// ============================================================================
// INTERFACCE
// ============================================================================

export interface LeadData {
    tipoRichiedente: 'azienda' | 'consulente' | 'intermediario' | null;
    fatturato: string;
    settore: string;
    importoOperazione: string;
    ruolo: string;
    email: string;
    mandatoScritto: string;
    nomeContatto: string;
    azienda: string;
}

export interface ScoringConfig {
    fatturatoAlto: number;
    fatturatoMedio: number;
    settoreHot: number;
    importoOperazioneAlto: number;
    ruoloDecisionale: number;
    ruoloOperativo: number;
    emailAziendale: number;
    mandatoScritto: number;
    mandatoVerbale: number;
    partnerRicorrente: number;
    sogliaWhale: number;
    sogliaHot: number;
    soglieFatturato: { alto: number; medio: number };
    soglieImporto: { alto: number };
    ruoliDecisionali: string[];
    settoriHot: string[];
    emailGratis: string[];
}

export interface LeadScore {
    totale: number;
    tier: 'Whale' | 'Hot' | 'Cold';
    dettagli: {
        azienda: number;
        referente: number;
        intermediario: number;
    };
    motivazioni: string[];
}

// ============================================================================
// CONFIGURAZIONE DI DEFAULT (Sempre disponibile come fallback sicuro)
// ============================================================================

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
    fatturatoAlto: 20,
    fatturatoMedio: 10,
    settoreHot: 10,
    importoOperazioneAlto: 10,
    ruoloDecisionale: 20,
    ruoloOperativo: 10,
    emailAziendale: 10,
    mandatoScritto: 20,
    mandatoVerbale: 5,
    partnerRicorrente: 10,
    sogliaWhale: 80,
    sogliaHot: 50,
    soglieFatturato: { alto: 10000000, medio: 2000000 },
    soglieImporto: { alto: 5000000 },
    ruoliDecisionali: ['ceo', 'cfo', 'owner', 'fondatore', 'direttore generale', 'partner', 'amministratore', 'presidente'],
    settoriHot: ['tech', 'finanza', 'energia', 'farmaceutico', 'aerospazio', 'biotech', 'fintech', 'sustainability', 'green'],
    emailGratis: ['gmail.com', 'yahoo.it', 'libero.it', 'hotmail.com', 'outlook.it', 'virgilio.it'],
};

// ============================================================================
// FUNZIONE DI CALCOLO (100% A PROVA DI ERRORE)
// ============================================================================

export function calcolaLeadScore(data: Partial<LeadData>, config?: any): LeadScore {
    const base = DEFAULT_SCORING_CONFIG;
    const safeConfig = config || {};

    // ✅ MERGE DIFENSIVO: Garantisce che gli array siano SEMPRE array, anche se la config è corrotta
    const cfg: ScoringConfig = {
        fatturatoAlto: safeConfig.fatturatoAlto ?? base.fatturatoAlto,
        fatturatoMedio: safeConfig.fatturatoMedio ?? base.fatturatoMedio,
        settoreHot: safeConfig.settoreHot ?? base.settoreHot,
        importoOperazioneAlto: safeConfig.importoOperazioneAlto ?? base.importoOperazioneAlto,
        ruoloDecisionale: safeConfig.ruoloDecisionale ?? base.ruoloDecisionale,
        ruoloOperativo: safeConfig.ruoloOperativo ?? base.ruoloOperativo,
        emailAziendale: safeConfig.emailAziendale ?? base.emailAziendale,
        mandatoScritto: safeConfig.mandatoScritto ?? base.mandatoScritto,
        mandatoVerbale: safeConfig.mandatoVerbale ?? base.mandatoVerbale,
        partnerRicorrente: safeConfig.partnerRicorrente ?? base.partnerRicorrente,
        sogliaWhale: safeConfig.sogliaWhale ?? base.sogliaWhale,
        sogliaHot: safeConfig.sogliaHot ?? base.sogliaHot,

        soglieFatturato: {
            alto: safeConfig.soglieFatturato?.alto ?? base.soglieFatturato.alto,
            medio: safeConfig.soglieFatturato?.medio ?? base.soglieFatturato.medio,
        },
        soglieImporto: {
            alto: safeConfig.soglieImporto?.alto ?? base.soglieImporto.alto,
        },

        // CRUCIALE: Se non è un array valido, usa forzatamente quello di default
        ruoliDecisionali: Array.isArray(safeConfig.ruoliDecisionali) ? safeConfig.ruoliDecisionali : base.ruoliDecisionali,
        settoriHot: Array.isArray(safeConfig.settoriHot) ? safeConfig.settoriHot : base.settoriHot,
        emailGratis: Array.isArray(safeConfig.emailGratis) ? safeConfig.emailGratis : base.emailGratis,
    };

    let scoreAzienda = 0;
    let scoreReferente = 0;
    let scoreIntermediario = 0;
    const motivazioni: string[] = [];

    // === AZIENDA (max 40) ===
    const fatturato = parseInt(data.fatturato?.replace(/[^0-9]/g, '') || '0');
    if (fatturato >= cfg.soglieFatturato.alto) {
        scoreAzienda += cfg.fatturatoAlto;
        motivazioni.push(`Fatturato alto (€${(fatturato / 1000000).toFixed(1)}M)`);
    } else if (fatturato >= cfg.soglieFatturato.medio) {
        scoreAzienda += cfg.fatturatoMedio;
        motivazioni.push(`Fatturato medio (€${(fatturato / 1000000).toFixed(1)}M)`);
    }

    if (data.settore && Array.isArray(cfg.settoriHot) && cfg.settoriHot.some(s => data.settore!.toLowerCase().includes(s))) {
        scoreAzienda += cfg.settoreHot;
        motivazioni.push(`Settore hot: ${data.settore}`);
    }

    const importoOp = parseInt(data.importoOperazione?.replace(/[^0-9]/g, '') || '0');
    if (importoOp >= cfg.soglieImporto.alto) {
        scoreAzienda += cfg.importoOperazioneAlto;
        motivazioni.push(`Operazione grande (€${(importoOp / 1000000).toFixed(1)}M)`);
    }

    // === REFERENTE (max 30) ===
    if (data.ruolo && Array.isArray(cfg.ruoliDecisionali)) {
        const ruoloLower = data.ruolo.toLowerCase();
        if (cfg.ruoliDecisionali.some(r => ruoloLower.includes(r))) {
            scoreReferente += cfg.ruoloDecisionale;
            motivazioni.push(`Ruolo decisionale: ${data.ruolo}`);
        } else {
            scoreReferente += cfg.ruoloOperativo;
        }
    }

    if (data.email && Array.isArray(cfg.emailGratis)) {
        const domain = data.email.split('@')[1]?.toLowerCase() || '';
        if (domain && !cfg.emailGratis.includes(domain)) {
            scoreReferente += cfg.emailAziendale;
            motivazioni.push(`Email aziendale: @${domain}`);
        }
    }

    // === INTERMEDIARIO (max 30) ===
    if (data.tipoRichiedente === 'consulente' || data.tipoRichiedente === 'intermediario') {
        if (data.mandatoScritto === 'si') {
            scoreIntermediario += cfg.mandatoScritto;
            motivazioni.push('Mandato scritto formale');
        } else if (data.mandatoScritto === 'verbale') {
            scoreIntermediario += cfg.mandatoVerbale;
        }
    } else if (data.tipoRichiedente === 'azienda') {
        scoreIntermediario = 10;
    }

    const totale = Math.min(100, scoreAzienda + scoreReferente + scoreIntermediario);

    let tier: 'Whale' | 'Hot' | 'Cold' = 'Cold';
    if (totale >= cfg.sogliaWhale) tier = 'Whale';
    else if (totale >= cfg.sogliaHot) tier = 'Hot';

    return {
        totale,
        tier,
        dettagli: { azienda: scoreAzienda, referente: scoreReferente, intermediario: scoreIntermediario },
        motivazioni
    };
}
