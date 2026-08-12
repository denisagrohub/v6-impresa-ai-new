import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission, requireAnyPermission, handleAuthError } from '@erpv6/auth';

const REQUESTS_PATH = path.join(process.cwd(), 'src/data/requests.json');

function ensureFile() {
    if (!fs.existsSync(REQUESTS_PATH)) {
        const defaultData = {
            riskReports: [],
            transferRequests: [],
            discountRequests: []
        };
        fs.writeFileSync(REQUESTS_PATH, JSON.stringify(defaultData, null, 2));
    }
}

function loadData() {
    ensureFile();
    return JSON.parse(fs.readFileSync(REQUESTS_PATH, 'utf-8'));
}

function saveData(data: any) {
    fs.writeFileSync(REQUESTS_PATH, JSON.stringify(data, null, 2));
}

export async function GET(request: NextRequest) {
    try {
        // Admin/Chief vedono tutto, consultant vede solo le proprie
        const authResult = requireAnyPermission(request, ['admin', 'chief', 'consultant']);
        if (authResult instanceof NextResponse) {
            return authResult;
        }
        const user = authResult;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const status = searchParams.get('status');
        const consultantId = searchParams.get('consultantId');

        const data = loadData();
        let items: any[] = [];

        if (type && data[type]) {
            items = [...data[type]];
        } else if (!type) {
            items = [
                ...data.riskReports,
                ...data.transferRequests,
                ...data.discountRequests
            ];
        }

        if (status) {
            items = items.filter((item: any) => item.status === status);
        }

        // Se è un consultant (non admin/chief), filtra solo le proprie richieste
        if (user.role === 'consultant') {
            items = items.filter((item: any) =>
                item.consultantId === user.id || item.requesterId === user.id
            );
        } else if (consultantId) {
            items = items.filter((item: any) =>
                item.consultantId === consultantId || item.requesterId === consultantId
            );
        }

        const stats = {
            riskReports: {
                total: data.riskReports.length,
                open: data.riskReports.filter((r: any) => r.status === 'open').length,
                resolved: data.riskReports.filter((r: any) => r.status === 'resolved').length,
            },
            transferRequests: {
                total: data.transferRequests.length,
                pending: data.transferRequests.filter((t: any) => t.status === 'pending').length,
            },
            discountRequests: {
                total: data.discountRequests.length,
                pending: data.discountRequests.filter((d: any) => d.status === 'pending').length,
            }
        };

        return NextResponse.json({ items, stats, type });
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const permissionCheck = requireAnyPermission(request, ['admin', 'chief', 'consultant']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        const data = loadData();

        const category = body.category || body.type;
        if (!data[category]) {
            data[category] = [];
        }

        const prefix = category === 'riskReports' ? 'RR' :
            category === 'transferRequests' ? 'TR' : 'DR';

        const newItem = {
            ...body,
            id: `${prefix}-${Date.now()}`,
            status: category === 'riskReports' ? 'open' : 'pending',
            createdAt: new Date().toISOString(),
            adminNotes: '',
            category: category
        };

        data[category].push(newItem);
        saveData(data);

        return NextResponse.json({ success: true, item: newItem });
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        const data = loadData();

        const { category, type, id, status, adminNotes, discountPercentage } = body;
        const targetCategory = category || type;

        if (!data[targetCategory]) {
            return NextResponse.json({ error: 'Categoria non valida' }, { status: 400 });
        }

        const index = data[targetCategory].findIndex((item: any) => item.id === id);
        if (index === -1) {
            return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 });
        }

        data[targetCategory][index].status = status;
        if (adminNotes) data[targetCategory][index].adminNotes = adminNotes;
        if (discountPercentage !== undefined) {
            data[targetCategory][index].discountPercentage = Number(discountPercentage);
        }
        data[targetCategory][index].updatedAt = new Date().toISOString();

        saveData(data);
        return NextResponse.json({ success: true, item: data[targetCategory][index] });
    } catch (error) {
        return handleAuthError(error);
    }
}
