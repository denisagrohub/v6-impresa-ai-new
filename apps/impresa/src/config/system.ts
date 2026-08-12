// Configurazione globale del sistema
// Flag per switchare tra Odoo e database locale

export const SYSTEM_CONFIG = {
    // 🎯 FLAG PRINCIPALE: true = usa Odoo, false = usa database locale
    USE_ODOO: process.env.NEXT_PUBLIC_USE_ODOO === 'true',

    // Brand attivo (multi-tenant)
    // Può essere impostato via: dominio, variabile env, o URL param
    ACTIVE_BRAND: process.env.NEXT_PUBLIC_ACTIVE_BRAND || 'progetto-impresa',

    // Configurazione Odoo
    ODOO: {
        URL: process.env.NEXT_PUBLIC_ODOO_URL || 'https://agrohub.odoo.com',
        DB: process.env.NEXT_PUBLIC_ODOO_DB || 'agrohub',
        API_KEY: process.env.ODOO_API_KEY || '',
        TIMEOUT: 5000,
    },

    // Modalità white-label
    WHITELABEL: {
        ENABLED: process.env.NEXT_PUBLIC_WHITELABEL === 'true',
        PARTNER_ID: process.env.NEXT_PUBLIC_PARTNER_ID || '',
    },
};

// Helper per determinare il brand attivo
export function getActiveBrand(): string {
    // Priorità: URL param > env > default
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const brandParam = params.get('brand');
        if (brandParam) return brandParam;
    }
    return SYSTEM_CONFIG.ACTIVE_BRAND;
}

// Helper per verificare se Odoo è attivo
export function isOdooEnabled(): boolean {
    return SYSTEM_CONFIG.USE_ODOO && !!SYSTEM_CONFIG.ODOO.API_KEY;
}
