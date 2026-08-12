import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requirePermission } from '@erpv6/auth';

const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function POST(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const body = await request.json();

        // Leggi i partner esistenti
        let partnersData: { partners: any[] } = { partners: [] };
        if (fs.existsSync(PARTNERS_PATH)) {
            partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
        }

        // Genera ID e Token univoco
        const newId = `PART-${Date.now()}`;
        const onboardingToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Scade in 7 giorni

        const newConsultant = {
            id: newId,
            type: 'consultant',
            name: body.name,
            email: body.email,
            phone: body.phone || '',
            company: body.company || '',
            vatNumber: body.vatNumber || '',
            status: 'pending_onboarding', // Stato iniziale
            contractType: body.contractType || 'percentage',
            commissionRate: Number(body.commissionRate) || 10,
            fixedFee: Number(body.fixedFee) || 0,
            hourlyRate: Number(body.hourlyRate) || 100,
            maxDiscount: Number(body.maxDiscount) || 5,
            specialties: body.specialties || [],
            onboardingToken,
            onboardingExpiresAt: expiresAt,
            createdAt: new Date().toISOString(),
            demo: false
        };

        partnersData.partners.push(newConsultant);
        fs.writeFileSync(PARTNERS_PATH, JSON.stringify(partnersData, null, 2));

        // In produzione: qui invieresti l'email con il link
        const onboardingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onboarding/${onboardingToken}`;

        return NextResponse.json({
            success: true,
            consultant: newConsultant,
            onboardingLink
        });
    } catch (error) {
        console.error('Errore creazione consulente:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
