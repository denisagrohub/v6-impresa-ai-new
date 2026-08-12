import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const permissionCheck = requirePermission(request, ['admin', 'chief']);
        if (permissionCheck instanceof NextResponse) {
            return permissionCheck;
        }

        const projectsPath = path.join(process.cwd(), 'src/data/projects.json');
        const leadsPath = path.join(process.cwd(), 'src/data/leads.json');
        const paymentsPath = path.join(process.cwd(), 'src/data/payments.json');

        let progettiAttivi = 0;
        let leadOggi = 0;
        let fatturatoMese = 0;
        let conversionRate = 0;

        if (fs.existsSync(projectsPath)) {
            const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));
            progettiAttivi = projects.filter((p: any) => p.status === 'in_corso').length;
        }

        if (fs.existsSync(leadsPath)) {
            const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'));
            const today = new Date().toISOString().split('T')[0];
            leadOggi = leads.filter((l: any) => l.createdAt?.startsWith(today)).length;
            const totalLeads = leads.length;
            const convertedLeads = leads.filter((l: any) => l.status === 'converted').length;
            conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
        }

        if (fs.existsSync(paymentsPath)) {
            const payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf-8'));
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            fatturatoMese = payments
                .filter((p: any) => {
                    const paymentDate = new Date(p.date);
                    return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
                })
                .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        }

        return NextResponse.json({
            progettiAttivi,
            leadOggi,
            fatturatoMese,
            conversionRate,
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
