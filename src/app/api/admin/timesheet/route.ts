import { NextRequest, NextResponse } from 'next/server';
import { gatewayGet, gatewayPut } from '@/lib/gateway-client';
import { requirePermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { searchParams } = new URL(request.url);
        const partnerId = searchParams.get('partnerId');
        const status = searchParams.get('status');

        const data = await gatewayGet('timesheet');
        let entries = data.entries || [];

        if (partnerId) entries = entries.filter((e: any) => e.partnerId === partnerId);
        if (status) entries = entries.filter((e: any) => e.status === status);

        const stats = {
            totalEntries: entries.length,
            totalHours: entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0),
            pendingHours: entries.filter((e: any) => e.status === 'pending').reduce((sum: number, e: any) => sum + (e.hours || 0), 0),
            approvedHours: entries.filter((e: any) => e.status === 'approved').reduce((sum: number, e: any) => sum + (e.hours || 0), 0),
            totalValue: entries.reduce((sum: number, e: any) => sum + ((e.hours || 0) * (e.hourlyRate || 0)), 0),
        };

        return NextResponse.json({ entries, stats });
    } catch (error) {
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        const result = await gatewayPut('timesheet', body, { id: body.id });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Errore aggiornamento' }, { status: 500 });
    }
}
