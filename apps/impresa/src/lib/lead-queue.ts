import fs from 'fs';
import os from 'os';
import path from 'path';
import { isOdooEnabled } from '@/config/system';
import { callOdooAPI } from './odoo-adapter';

// process.cwd() punta al bundle deployato: su Vercel il filesystem della
// funzione serverless è read-only ovunque tranne /tmp. Scrivere lì
// (process.cwd()) fa fallire fs.writeFileSync con EROFS e, prima di questo
// fix, l'eccezione risaliva non gestita fino a /api/leads facendola
// rispondere 500 senza salvare il lead da nessuna parte. /tmp è scrivibile
// ma effimero (sopravvive solo finché l'istanza lambda resta warm) — è un
// tappabuchi per non perdere il lead in caso di crash improvviso, non una
// coda persistente: il canale affidabile resta l'invio diretto a Odoo.
const QUEUE_PATH = path.join(os.tmpdir(), 'pending-leads.json');

function ensureQueueFile(): void {
    if (!fs.existsSync(QUEUE_PATH)) {
        fs.writeFileSync(QUEUE_PATH, JSON.stringify({ leads: [] }, null, 2));
    }
}

// L'intervista produce campi in italiano (nome, telefono, azienda, obiettivi,
// settore, score, packageId, ...); /api/v1/leads (lead_api.py) richiede
// name/email obbligatori, accetta phone/company_name/description/score/
// package_hint/verticale opzionali, tutti in inglese. Le risposte che non
// hanno un campo Odoo dedicato (fatturato, dipendenti, budget, ecc.) vengono
// comunque accodate in coda a description invece di essere scartate in
// silenzio - erano dati raccolti dall'utente e mai arrivati a Odoo.
const CORE_FIELDS = new Set([
    'nome', 'email', 'telefono', 'azienda', 'obiettivi',
    'settore', 'score', 'packageId', 'package', 'recommendedLevel', 'estimatedPrice', 'timestamp',
]);

function formatExtraAnswers(data: Record<string, any>): string {
    return Object.entries(data)
        .filter(([key, value]) => !CORE_FIELDS.has(key) && value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
}

function mapLeadDataForOdoo(data: Record<string, any>): Record<string, any> {
    const extra = formatExtraAnswers(data);
    return {
        name: data.nome || '',
        email: data.email || '',
        phone: data.telefono || '',
        company_name: data.azienda || '',
        description: extra ? `${data.obiettivi || ''}\n\n${extra}`.trim() : (data.obiettivi || ''),
        // NON scrivere qui su fenice_score/fenice_livello: sono campi
        // specifici della verticale Fenice (Selection 'I'/'II'/'III'/'IV',
        // dominio incompatibile con 'L1'/'L2'/'L3' di questa intervista) e
        // scriverli causerebbe un ValueError su lead di un'altra verticale.
        // score/package_hint finiscono invece su production_order via
        // _start_production, che e' lo scoring generico corretto per questo sito.
        score: data.score,
        package_hint: data.packageId || data.recommendedLevel,
        settore: data.settore || '',
    };
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

// Salva un lead (su Odoo o in coda locale). Non lancia mai: se anche il
// fallback locale fallisce, il lead completo finisce comunque nei log
// (console.error, recuperabili da Vercel) invece di sparire in un 500 muto.
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
                body: JSON.stringify(mapLeadDataForOdoo(leadData)),
            });

            lead.synced = true;
            console.debug(`✅ Lead ${lead.id} salvato su Odoo`);
            return { success: true, queued: false };
        } catch (error) {
            console.error('⚠️ Odoo non disponibile, salvataggio in coda locale:', error);
            return await fallbackToQueue(lead);
        }
    } else {
        // Odoo non è abilitato, salva sempre in coda locale
        return await fallbackToQueue(lead);
    }
}

async function fallbackToQueue(lead: Lead): Promise<{ success: boolean; queued: boolean }> {
    const queued = await saveLeadToQueue(lead);
    if (!queued) {
        // Nessun canale ha funzionato: il lead non è recuperabile automaticamente.
        // Lo logghiamo per intero così resta almeno recuperabile a mano dai log.
        console.error(`🔥 Lead ${lead.id} PERSO (Odoo e coda locale entrambi falliti). Dati completi:`, JSON.stringify(lead));
    }
    return { success: queued, queued };
}

// Salva un lead nella coda locale (best-effort, vedi commento su QUEUE_PATH).
// Non lancia mai: ritorna false se anche /tmp non è scrivibile.
async function saveLeadToQueue(lead: Lead): Promise<boolean> {
    try {
        ensureQueueFile();
        const fileContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
        const queue = JSON.parse(fileContent);
        queue.leads.push(lead);
        fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
        console.debug(` Lead ${lead.id} aggiunto alla coda locale`);
        return true;
    } catch (error) {
        console.error('❌ Errore nel salvataggio in coda locale:', error);
        return false;
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
                body: JSON.stringify(mapLeadDataForOdoo(lead.data)),
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
