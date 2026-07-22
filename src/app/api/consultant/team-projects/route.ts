import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECTS_PATH = path.join(process.cwd(), 'src/data/projects.json');
const PARTNERS_PATH = path.join(process.cwd(), 'src/data/partners.json');

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const consultantId = searchParams.get('consultantId');
        const filterConsultant = searchParams.get('filterConsultant');
        const filterStatus = searchParams.get('filterStatus');
        const filterSector = searchParams.get('filterSector');

        if (!consultantId) {
            return NextResponse.json({ error: 'consultantId richiesto' }, { status: 400 });
        }

        // Verifica che l'utente sia un Chief Consultant
        if (!fs.existsSync(PARTNERS_PATH)) {
            return NextResponse.json({ error: 'Partner non trovati' }, { status: 500 });
        }

        const partnersData = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf-8'));
        const currentUser = partnersData.partners.find((p: any) => p.id === consultantId);

        if (!currentUser || !currentUser.isChief) {
            return NextResponse.json({ error: 'Accesso negato. Solo Chief Consultant possono accedere.' }, { status: 403 });
        }

        // Ottieni tutti i consulenti dello stesso brand
        const teamConsultants = partnersData.partners.filter((p: any) =>
            p.type === 'consultant' &&
            p.brand === currentUser.brand
        );

        // Carica tutti i progetti
        if (!fs.existsSync(PROJECTS_PATH)) {
            return NextResponse.json({ projects: [], teamConsultants: [] });
        }

        const projectsData = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf-8'));
        let projects = projectsData.projects || [];

        // Filtra per consulente
        if (filterConsultant) {
            projects = projects.filter((p: any) => p.consultantId === filterConsultant);
        }

        // Filtra per stato
        if (filterStatus) {
            projects = projects.filter((p: any) => p.stato === filterStatus);
        }

        // Filtra per settore
        if (filterSector) {
            projects = projects.filter((p: any) => p.settore === filterSector);
        }

        // Calcola statistiche
        const stats = {
            total: projects.length,
            active: projects.filter((p: any) => p.stato === 'in_corso').length,
            completed: projects.filter((p: any) => p.stato === 'completato').length,
            pending: projects.filter((p: any) => p.stato === 'in_attesa').length,
            blocked: projects.filter((p: any) => p.stato === 'bloccato').length,
        };

        return NextResponse.json({
            projects,
            teamConsultants,
            stats,
            currentUser: {
                id: currentUser.id,
                name: currentUser.name,
                isChief: currentUser.isChief,
                brand: currentUser.brand
            }
        });

    } catch (error) {
        console.error('Errore lettura progetti team:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
