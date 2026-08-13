import fs from 'fs';
import path from 'path';
import { isOdooEnabled } from '@/config/system';
import { callOdooAPI } from './odoo-adapter';

const QUEUE_PATH = path.join(process.cwd(), 'src/data/pending-leads.json');

function ensureQueueFile(): void {
    if (!fs.existsSync(QUEUE_PATH)) {
        fs.writeFileSync(QUEUE_PATH, JSON.stringify({ leads: [] }, null, 2));
    }
}

// Struttura di un lead
export interface Lead {
    id: string;
    timestamp: string;
    source: string; // es. 'l1', 'l2', 'l3', 'contatti'
    data: Record<string, any>;
    synced: boolean;
    syncAttempts: number;
    lastSyncAttempt?: string;
    error?: string;
}

// Salva un lead (su Odoo o in coda locale)
export async function saveLead(leadData: Record<string, any>, source: string): Promise<{ success: boolean; queued?: boolean }> {
    const lead: Lead = {
        id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        source,
        data: leadData,
        synced: false,
        syncAttempts: 0,
    };

    if (isOdooEnabled()) {
        try {
            // Prova a inviare a Odoo
            await callOdooAPI('/api/v1/leads', {
                method: 'POST',
                body: JSON.stringify(leadData),
            });

            lead.synced = true;
            console.debug(`✅ Lead ${lead.id} salvato su Odoo`);
            return { success: true, queued: false };
        } catch (error) {
            console.error('⚠️ Odoo non disponibile, salvataggio in coda locale:', error);
            // Odoo è down, salva in coda locale
            await saveLeadToQueue(lead);
            return { success: true, queued: true };
        }
    } else {
        // Odoo non è abilitato, salva sempre in coda locale
        await saveLeadToQueue(lead);
        return { success: true, queued: true };
    }
}

// Salva un lead nella coda locale
async function saveLeadToQueue(lead: Lead): Promise<void> {
    // In produzione, questo scriverebbe su un database
    // Per ora, usiamo un file JSON (da migliorare con un DB vero)
    ensureQueueFile();

    try {
        const fileContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
        const queue = JSON.parse(fileContent);
        queue.leads.push(lead);
        fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
        console.debug(` Lead ${lead.id} aggiunto alla coda locale`);
    } catch (error) {
        console.error('❌ Errore nel salvataggio in coda:', error);
        throw error;
    }
}

// Ottieni tutti i lead pendenti
export async function getPendingLeads(): Promise<Lead[]> {
    ensureQueueFile();

    try {
        const fileContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
        const queue = JSON.parse(fileContent);
        return queue.leads.filter((l: Lead) => !l.synced);
    } catch (error) {
        console.error('Errore lettura coda:', error);
        return [];
    }
}

// Sincronizza i lead pendenti con Odoo
export async function syncPendingLeads(): Promise<{ synced: number; failed: number }> {
    if (!isOdooEnabled()) {
        return { synced: 0, failed: 0 };
    }

    const pendingLeads = await getPendingLeads();
    let synced = 0;
    let failed = 0;

    for (const lead of pendingLeads) {
        try {
            await callOdooAPI('/api/v1/leads', {
                method: 'POST',
                body: JSON.stringify(lead.data),
            });

            lead.synced = true;
            lead.syncAttempts++;
            lead.lastSyncAttempt = new Date().toISOString();
            synced++;
            console.debug(`✅ Lead ${lead.id} sincronizzato`);
        } catch (error) {
            lead.syncAttempts++;
            lead.lastSyncAttempt = new Date().toISOString();
            lead.error = error instanceof Error ? error.message : 'Errore sconosciuto';
            failed++;
            console.error(`❌ Lead ${lead.id} fallito (tentativo ${lead.syncAttempts}):`, error);
        }
    }

    // Aggiorna il file con lo stato dei lead
    ensureQueueFile();
    const fileContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
    const queue = JSON.parse(fileContent);
    queue.leads = pendingLeads;
    queue.lastSync = new Date().toISOString();
    queue.syncStatus = failed > 0 ? 'partial' : 'complete';
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));

    return { synced, failed };
}
