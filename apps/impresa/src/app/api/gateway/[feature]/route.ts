import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getFeatureSchema, listFeatures } from '@erpv6/gateway-client';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/secure-config.json');

// ============ CONFIG HELPER ============
function getConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {
        return { demoMode: true, useOdoo: false };
    }
}

// ============ LISTA FEATURE (per debug) ============
export async function GET(
    request: NextRequest,
    { params }: { params: { feature: string } }
) {
    const { feature } = params;

    // Endpoint speciale: lista tutte le feature
    if (feature === '_list') {
        return NextResponse.json({ features: listFeatures() });
    }

    const schema = getFeatureSchema(feature);
    if (!schema) {
        return NextResponse.json(
            { error: `Feature "${feature}" non trovata`, available: Object.keys(require('@erpv6/gateway-client').GATEWAY_SCHEMA) },
            { status: 404 }
        );
    }

    const config = getConfig();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clientId = searchParams.get('clientId');

    console.log(`🔍 [GATEWAY] GET ${feature} | demo=${config.demoMode} odoo=${config.useOdoo} id=${id}`);

    // Se DEMO MODE → sempre fallback locale
    if (config.demoMode) {
        return readLocal(schema, id, clientId);
    }

    // Se ODOO ENABLED → prova Odoo
    if (config.useOdoo && schema.odooEndpoint) {
        try {
            const odooData = await readOdoo(schema, id, clientId, config);
            const mapped = schema.mapFromOdoo ? schema.mapFromOdoo(odooData, { id, clientId }) : odooData;
            return NextResponse.json(mapped);
        } catch (error) {
            console.warn(`⚠️ [GATEWAY] Odoo non disponibile per ${feature}, fallback locale`);
        }
    }

    // Fallback: locale
    return readLocal(schema, id, clientId);
}

// ============ CREATE (POST) ============
export async function POST(
    request: NextRequest,
    { params }: { params: { feature: string } }
) {
    const schema = getFeatureSchema(params.feature);
    if (!schema) {
        return NextResponse.json({ error: 'Feature non trovata' }, { status: 404 });
    }

    const config = getConfig();
    const body = await request.json();

    console.log(`➕ [GATEWAY] POST ${params.feature} | demo=${config.demoMode} odoo=${config.useOdoo}`);

    // DEMO MODE → locale
    if (config.demoMode) {
        return writeLocal(schema, body, 'create');
    }

    // ODOO ENABLED → prova Odoo
    if (config.useOdoo && schema.odooEndpoint) {
        try {
            const payload = schema.mapToOdoo ? schema.mapToOdoo(body) : body;
            const result = await writeOdoo(schema, payload, config, 'POST');
            return NextResponse.json(result);
        } catch (error) {
            console.warn(`⚠️ [GATEWAY] Odoo non disponibile per ${params.feature}, fallback locale`);
        }
    }

    return writeLocal(schema, body, 'create');
}

// ============ UPDATE (PUT) ============
export async function PUT(
    request: NextRequest,
    { params }: { params: { feature: string } }
) {
    const schema = getFeatureSchema(params.feature);
    if (!schema) {
        return NextResponse.json({ error: 'Feature non trovata' }, { status: 404 });
    }

    const config = getConfig();
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log(`✏️ [GATEWAY] PUT ${params.feature} id=${id} | demo=${config.demoMode} odoo=${config.useOdoo}`);

    if (config.demoMode) {
        return writeLocal(schema, body, 'update', id);
    }

    if (config.useOdoo && schema.odooEndpoint) {
        try {
            const payload = schema.mapToOdoo ? schema.mapToOdoo(body) : body;
            const result = await writeOdoo(schema, payload, config, 'PUT', id);
            return NextResponse.json(result);
        } catch (error) {
            console.warn(`⚠️ [GATEWAY] Odoo non disponibile per ${params.feature}, fallback locale`);
        }
    }

    return writeLocal(schema, body, 'update', id);
}

// ============ DELETE ============
export async function DELETE(
    request: NextRequest,
    { params }: { params: { feature: string } }
) {
    const schema = getFeatureSchema(params.feature);
    if (!schema) {
        return NextResponse.json({ error: 'Feature non trovata' }, { status: 404 });
    }

    const config = getConfig();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log(`🗑️ [GATEWAY] DELETE ${params.feature} id=${id} | demo=${config.demoMode}`);

    if (config.demoMode || !config.useOdoo || !schema.odooEndpoint) {
        return deleteLocal(schema, id);
    }

    try {
        const result = await writeOdoo(schema, null, config, 'DELETE', id);
        return NextResponse.json(result);
    } catch (error) {
        console.warn(`⚠️ [GATEWAY] Odoo non disponibile per ${params.feature}, fallback locale`);
        return deleteLocal(schema, id);
    }
}

// ============ HELPER: READ LOCAL ============
function readLocal(schema: any, id?: string | null, clientId?: string | null): NextResponse {
    try {
        const fullPath = path.join(process.cwd(), schema.localFallback);

        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: 'File locale non trovato' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

        // Se richiede ID, filtra
        if (schema.requiresId && id) {
            if (Array.isArray(data)) {
                const item = data.find((i: any) => i.id === id);
                return item
                    ? NextResponse.json(item)
                    : NextResponse.json({ error: 'Elemento non trovato' }, { status: 404 });
            }
            if (data[schema.id] && Array.isArray(data[schema.id])) {
                const item = data[schema.id].find((i: any) => i.id === id);
                return item
                    ? NextResponse.json(item)
                    : NextResponse.json({ error: 'Elemento non trovato' }, { status: 404 });
            }
        }

        // Se richiede clientId, filtra
        if (clientId && schema.id === 'dashboard') {
            // Per dashboard, ritorna i dati mock (in futuro: filtra per cliente)
            return NextResponse.json(data);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error(`[GATEWAY] Errore lettura locale ${schema.localFallback}:`, error);
        return NextResponse.json({ error: 'Errore lettura file locale' }, { status: 500 });
    }
}

// ============ HELPER: READ ODOO ============
async function readOdoo(schema: any, id?: string | null, clientId?: string | null, config?: any): Promise<any> {
    if (!config) config = getConfig();

    let url = `${config.odooUrl}${schema.odooEndpoint}`;
    if (id) url += `/${id}`;
    if (clientId) url += `?client_id=${clientId}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${config.odooApiKey}`,
            'Content-Type': 'application/json',
        },
        next: { revalidate: 60 },
    });

    if (!response.ok) {
        throw new Error(`Odoo error: ${response.status}`);
    }

    return response.json();
}

// ============ HELPER: WRITE LOCAL ============
function writeLocal(schema: any, data: any, action: 'create' | 'update', id?: string | null): NextResponse {
    try {
        const fullPath = path.join(process.cwd(), schema.localFallback);

        let fileData: any = {};
        if (fs.existsSync(fullPath)) {
            fileData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        }

        if (action === 'create') {
            // Aggiungi nuovo elemento
            const newItem = {
                ...data,
                id: data.id || `${schema.id.toUpperCase()}-${Date.now()}`,
                createdAt: new Date().toISOString(),
            };

            if (Array.isArray(fileData)) {
                fileData.push(newItem);
            } else if (fileData[schema.id] && Array.isArray(fileData[schema.id])) {
                fileData[schema.id].push(newItem);
            } else {
                // Struttura semplice: salva tutto
                fileData = { ...fileData, ...newItem };
            }

            fs.writeFileSync(fullPath, JSON.stringify(fileData, null, 2));
            return NextResponse.json({ success: true, id: newItem.id, item: newItem });
        }

        if (action === 'update' && id) {
            // Aggiorna elemento esistente
            if (Array.isArray(fileData)) {
                const index = fileData.findIndex((i: any) => i.id === id);
                if (index >= 0) {
                    fileData[index] = { ...fileData[index], ...data, updatedAt: new Date().toISOString() };
                }
            } else if (fileData[schema.id] && Array.isArray(fileData[schema.id])) {
                const index = fileData[schema.id].findIndex((i: any) => i.id === id);
                if (index >= 0) {
                    fileData[schema.id][index] = { ...fileData[schema.id][index], ...data, updatedAt: new Date().toISOString() };
                }
            } else {
                fileData = { ...fileData, ...data, updatedAt: new Date().toISOString() };
            }

            fs.writeFileSync(fullPath, JSON.stringify(fileData, null, 2));
            return NextResponse.json({ success: true, id });
        }

        return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 });
    } catch (error) {
        console.error(`[GATEWAY] Errore scrittura locale:`, error);
        return NextResponse.json({ error: 'Errore scrittura file locale' }, { status: 500 });
    }
}

// ============ HELPER: DELETE LOCAL ============
function deleteLocal(schema: any, id?: string | null): NextResponse {
    try {
        const fullPath = path.join(process.cwd(), schema.localFallback);

        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
        }

        const fileData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

        if (id) {
            if (Array.isArray(fileData)) {
                const filtered = fileData.filter((i: any) => i.id !== id);
                fs.writeFileSync(fullPath, JSON.stringify(filtered, null, 2));
                return NextResponse.json({ success: true, deleted: id });
            }
            if (fileData[schema.id] && Array.isArray(fileData[schema.id])) {
                fileData[schema.id] = fileData[schema.id].filter((i: any) => i.id !== id);
                fs.writeFileSync(fullPath, JSON.stringify(fileData, null, 2));
                return NextResponse.json({ success: true, deleted: id });
            }
        }

        return NextResponse.json({ error: 'ID richiesto per eliminazione' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
    }
}
// Aggiungi alla fine del file, prima degli helper functions

// Endpoint speciale per listare tutti i pagamenti con filtri
async function getPaymentsInternal(request: NextRequest) {
    const config = getConfig();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const demo = searchParams.get('demo');

    try {
        const fullPath = path.join(process.cwd(), 'src/data/invoices.json');

        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ invoices: [] });
        }

        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        let invoices = data.invoices || [];

        // Filtri
        if (clientId) {
            invoices = invoices.filter((inv: any) => inv.clientId === clientId);
        }
        if (status) {
            invoices = invoices.filter((inv: any) => inv.status === status);
        }
        if (demo !== null) {
            const isDemo = demo === 'true';
            invoices = invoices.filter((inv: any) => inv.demo === isDemo);
        }

        // Stats
        const stats = {
            total: invoices.length,
            pending: invoices.filter((i: any) => i.status === 'pending').length,
            paid: invoices.filter((i: any) => i.status === 'paid').length,
            overdue: invoices.filter((i: any) => i.status === 'overdue').length,
            totalAmount: invoices.reduce((sum: number, i: any) => sum + (i.amount || 0), 0),
            paidAmount: invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + (i.amount || 0), 0),
        };

        return NextResponse.json({ invoices, stats });
    } catch (error) {
        console.error('Errore lettura pagamenti:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
// ============ HELPER: WRITE ODOO ============
async function writeOdoo(schema: any, payload: any, config: any, method: string, id?: string | null): Promise<any> {
    let url = `${config.odooUrl}${schema.odooEndpoint}`;
    if (id) url += `/${id}`;

    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${config.odooApiKey}`,
            'Content-Type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
        throw new Error(`Odoo error: ${response.status}`);
    }

    return response.json();
}
