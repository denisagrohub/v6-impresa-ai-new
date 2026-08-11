import { NextRequest, NextResponse } from 'next/server';
import { gatewayGet, gatewayPost, gatewayPut, gatewayDelete } from '@/lib/gateway-client';
import { requirePermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const status = searchParams.get('status');
        const id = searchParams.get('id');

        // Usa il gateway per leggere i dati
        const data = await gatewayGet('partners', { id: id || undefined });

        // Se richiede un ID specifico
        if (id) {
            return NextResponse.json(data);
        }

        // Altrimenti filtra e calcola stats
        let partners = data.partners || [];

        if (type && type !== 'all') {
            partners = partners.filter((p: any) => p.type === type);
        }
        if (status) {
            partners = partners.filter((p: any) => p.status === status);
        }

        const stats = {
            total: partners.length,
            consultants: partners.filter((p: any) => p.type === 'consultant').length,
            referrals: partners.filter((p: any) => p.type === 'referral').length,
            active: partners.filter((p: any) => p.status === 'active').length,
            pending: partners.filter((p: any) => p.status === 'pending').length,
        };

        return NextResponse.json({ partners, stats });
    } catch (error) {
        console.error('Errore lettura partner:', error);
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
        const result = await gatewayPost('partners', body);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Errore creazione partner' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();
        const result = await gatewayPut('partners', body, { id: body.id });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Errore aggiornamento' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const result = await gatewayDelete('partners', { id: id! });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
    }
}
