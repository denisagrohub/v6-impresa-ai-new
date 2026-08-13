import { SYSTEM_CONFIG, isOdooEnabled } from '@/config/system';

export interface OdooConfig {
    url: string;
    db: string;
    apiKey: string;
}

function resolveConfig(config?: OdooConfig): OdooConfig {
    return {
        url: config?.url || SYSTEM_CONFIG.ODOO.URL,
        db: config?.db || SYSTEM_CONFIG.ODOO.DB,
        apiKey: config?.apiKey || SYSTEM_CONFIG.ODOO.API_KEY,
    };
}

/**
 * Chiama un endpoint REST esposto da erpv6_api_gateway.
 * In modalità reale non finge mai successo: un errore di rete, un timeout
 * o una risposta HTTP non-2xx vengono propagati come eccezione (mai
 * mascherati in un { success: true } fabbricato), così i chiamanti che
 * fanno già fallback su errore (es. lead-queue.ts) si attivano davvero.
 */
export async function callOdooAPI(endpoint: string, payload?: any, config?: OdooConfig): Promise<any> {
    if (!isOdooEnabled()) {
        console.debug(`🔄 [MOCK] Odoo API call to ${endpoint}:`, payload);
        return { success: true, data: { id: 'mock_id' } };
    }

    const { url, apiKey } = resolveConfig(config);
    const target = `${url.replace(/\/$/, '')}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYSTEM_CONFIG.ODOO.TIMEOUT);

    const method = payload?.method || 'POST';
    const body = payload?.body !== undefined ? payload.body : (payload !== undefined ? JSON.stringify(payload) : undefined);

    let response: Response;
    try {
        response = await fetch(target, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'X-API-Key': apiKey } : {}),
                ...(payload?.headers || {}),
            },
            body,
            signal: controller.signal,
        });
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Odoo API ${endpoint} non ha risposto entro ${SYSTEM_CONFIG.ODOO.TIMEOUT}ms (${target})`);
        }
        throw new Error(`Odoo non raggiungibile su ${target}: ${error.message}`);
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`Odoo API ${endpoint} ha risposto ${response.status} ${response.statusText}: ${bodyText.slice(0, 300)}`);
    }

    return response.json();
}

/**
 * Sincronizza un lead con erpv6_api_gateway (/api/v1/leads).
 * Nessun caller attuale nel repo, ma resta parte della superficie pubblica
 * del modulo: deve comunque fallire in modo esplicito, non fabbricare id.
 */
export async function syncLeadToOdoo(leadData: any, config?: OdooConfig): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!isOdooEnabled()) {
        console.debug('🔄 [MOCK] Sync lead to Odoo:', leadData.azienda || leadData.nome);
        return { success: true, id: `MOCK_${Date.now()}` };
    }
    try {
        const result = await callOdooAPI('/api/v1/leads', { method: 'POST', body: JSON.stringify(leadData) }, config);
        return { success: true, id: String(result.id ?? result.lead_id ?? '') };
    } catch (error: any) {
        console.error('❌ Odoo sync failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Nessun endpoint reale in erpv6_api_gateway espone un elenco filtrato di
 * partner per tipo (esiste solo /api/v1/partner/profile, per il profilo del
 * partner autenticato, semantica diversa). Piuttosto che inventare un URL
 * inesistente, questa funzione fallisce esplicitamente in modalità reale
 * finché non esiste un endpoint dedicato — non deve MAI restituire [] come
 * se "nessun partner trovato" quando in realtà la chiamata non è mai stata
 * tentata.
 */
export async function getOdooPartners(type: 'consultant' | 'referral' | 'all'): Promise<any[]> {
    if (!isOdooEnabled()) {
        console.debug(`🔄 [MOCK] Get Odoo partners (${type}): []`);
        return [];
    }
    throw new Error(
        `getOdooPartners('${type}') non è implementata: erpv6_api_gateway non espone ancora un endpoint per elencare partner per tipo (solo /api/v1/partner/profile, che è per il profilo del partner autenticato). Va aggiunto un controller dedicato prima di poter usare questa funzione con USE_ODOO=true.`
    );
}
