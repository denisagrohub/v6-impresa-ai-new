import { NextRequest, NextResponse } from 'next/server';
import { gatewayGet, gatewayPost, gatewayPut } from '@erpv6/gateway-client';
import { requirePermission } from '@erpv6/auth';

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { searchParams } = new URL(request.url);
        const partnerId = searchParams.get('partnerId');
        const status = searchParams.get('status');

        const data = await gatewayGet('partner-payments');
        let payments = data.payments || [];

        if (partnerId) payments = payments.filter((p: any) => p.partnerId === partnerId);
        if (status) payments = payments.filter((p: any) => p.status === status);

        const stats = {
            total: payments.length,
            pending: payments.filter((p: any) => p.status === 'pending').length,
            paid: payments.filter((p: any) => p.status === 'paid').length,
            totalPendingAmount: payments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0),
            totalPaidAmount: payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0),
        };

        return NextResponse.json({ payments, stats });
    } catch (error) {
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        const result = await gatewayPost('partner-payments', body);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Errore creazione pagamento' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        const result = await gatewayPut('partner-payments', body, { id: body.id });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Errore aggiornamento' }, { status: 500 });
    }
}
