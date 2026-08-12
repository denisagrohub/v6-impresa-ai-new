export interface FeatureSchema {
    id: string;
    description: string;
    odooEndpoint?: string | null;
    localFallback: string;
    requiresId?: boolean;
    mapFromOdoo?: (odooData: any, params?: any) => any;
    mapToOdoo?: (localData: any, params?: any) => any;
}

export const GATEWAY_SCHEMA: Record<string, FeatureSchema> = {
    // ============ DASHBOARD ============
    'dashboard': {
        id: 'dashboard',
        description: 'Dati dashboard cliente',
        odooEndpoint: '/api/client-portal',
        localFallback: 'src/data/dashboard-mock.json',
        requiresId: true,
    },

    // ============ PAGAMENTI ============
    'payments': {
        id: 'payments',
        description: 'Gestione pagamenti/fatture',
        odooEndpoint: '/api/account.move',
        localFallback: 'src/data/invoices.json',
        requiresId: true,
    },

    // ============ LEAD SCORING ============
    'lead-scoring': {
        id: 'lead-scoring',
        description: 'Configurazione scoring lead',
        odooEndpoint: '/api/pi.scoring.config',
        localFallback: 'src/data/scoring-config.json',
    },

    // ============ PRICING ENGINE ============
    'pricing': {
        id: 'pricing',
        description: 'Configurazione pricing L3',
        odooEndpoint: '/api/pi.pricing.config',
        localFallback: 'src/data/pricing-config.json',
    },

    // ============ BRAND ============
    'brand': {
        id: 'brand',
        description: 'Dati brand/white-label',
        odooEndpoint: '/api/pi.brand',
        localFallback: 'src/data/local-db.json',
        requiresId: true,
    },

    // ============ DEMO MODE ============
    'demo-mode': {
        id: 'demo-mode',
        description: 'Stato modalità demo',
        odooEndpoint: null,
        localFallback: 'src/data/secure-config.json',
    },

    // ============ LEAD RECOVERY ============
    'lead-recovery': {
        id: 'lead-recovery',
        description: 'Gestione lead abbandonati',
        odooEndpoint: '/api/pi.lead.recovery',
        localFallback: 'src/data/drafts.json',
    },

    // ============ PARTNER ============
    'partners': {
        id: 'partners',
        description: 'Gestione consulenti e referral esterni',
        odooEndpoint: '/api/pi.partner',
        localFallback: 'src/data/partners.json',
        requiresId: true,
    },

    // ============ TIMESHEET ============
    'timesheet': {
        id: 'timesheet',
        description: 'Registrazione ore consulenti',
        odooEndpoint: '/api/account.analytic.line',
        localFallback: 'src/data/timesheet.json',
        requiresId: true,
    },

    // ============ PAGAMENTI PARTNER ============
    'partner-payments': {
        id: 'partner-payments',
        description: 'Pagamenti provvigioni a partner',
        odooEndpoint: '/api/pi.partner.payment',
        localFallback: 'src/data/partner-payments.json',
        requiresId: true,
    },

    // ============ CALENDAR EVENTS ============
    'calendar-events': {
        id: 'calendar-events',
        description: 'Gestione calendario consulenti e slot pubblici',
        odooEndpoint: '/api/pi/booking',
        localFallback: 'src/data/consultant-calendar.json',
        requiresId: false,
        mapFromOdoo: (odooData: any) => {
            return {
                events: odooData.events || [],
                settings: {
                    maxDailyPublicSlots: 3,
                    defaultDuration: 60,
                    workingHours: {
                        start: "09:00",
                        end: "18:00",
                        days: [1, 2, 3, 4, 5]
                    }
                }
            };
        },
        mapToOdoo: (localData: any) => {
            return localData;
        },
    },

    // ============ TEAM AVAILABILITY ============
    'team-availability': {
        id: 'team-availability',
        description: 'Disponibilità team (solo busy/free)',
        odooEndpoint: '/api/pi/booking/team-availability',
        localFallback: 'src/data/consultant-calendar.json',
        requiresId: false,
    },

    // ============ PUBLIC SLOTS ============
    'public-slots': {
        id: 'public-slots',
        description: 'Slot pubblici prenotabili',
        odooEndpoint: '/api/pi/booking/public-slots',
        localFallback: 'src/data/consultant-calendar.json',
        requiresId: false,
    },
}; // <-- QUI CHIUDIAMO CORRETTAMENTE L'OGGETTO

export function getFeatureSchema(featureId: string): FeatureSchema | null {
    return GATEWAY_SCHEMA[featureId] || null;
}

export function listFeatures() {
    return Object.values(GATEWAY_SCHEMA).map(f => ({
        id: f.id,
        description: f.description,
        hasOdooEndpoint: !!f.odooEndpoint,
        requiresId: !!f.requiresId,
    }));
}
