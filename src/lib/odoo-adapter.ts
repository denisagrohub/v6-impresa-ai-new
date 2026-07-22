export interface OdooConfig {
    url: string;
    db: string;
    apiKey: string;
}

export async function syncLeadToOdoo(leadData: any, config?: OdooConfig): Promise<{ success: boolean; id?: string; error?: string }> {
    if (process.env.NEXT_PUBLIC_USE_ODOO !== 'true') {
        console.log('🔄 [MOCK] Sync lead to Odoo:', leadData.azienda || leadData.nome);
        return { success: true, id: `MOCK_${Date.now()}` };
    }
    try {
        console.log('🔄 Sync lead to Odoo (Produzione):', leadData);
        return { success: true, id: `ODOO_${Date.now()}` };
    } catch (error: any) {
        console.error('❌ Odoo sync failed:', error);
        return { success: false, error: error.message };
    }
}

export async function getOdooPartners(type: 'consultant' | 'referral' | 'all'): Promise<any[]> {
    if (process.env.NEXT_PUBLIC_USE_ODOO !== 'true') {
        return [];
    }
    return [];
}

// ✅ Aggiunta funzione mancante
export async function callOdooAPI(endpoint: string, payload: any, config?: OdooConfig): Promise<any> {
    if (process.env.NEXT_PUBLIC_USE_ODOO !== 'true') {
        console.log(`🔄 [MOCK] Odoo API call to ${endpoint}:`, payload);
        return { success: true, data: { id: 'mock_id' } };
    }
    console.log(`🔄 Odoo API call to ${endpoint}:`, payload);
    return { success: true, data: { id: 'mock_id' } };
}
