import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PERMISSIONS_PATH = path.join(process.cwd(), 'src/data/document-permissions.json');

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId richiesto' }, { status: 400 });
        }

        if (!fs.existsSync(PERMISSIONS_PATH)) {
            return NextResponse.json({ documents: [], projectName: '', clientName: '' });
        }

        const data = JSON.parse(fs.readFileSync(PERMISSIONS_PATH, 'utf-8'));
        const projectPerms = data.permissions.find((p: any) => p.projectId === projectId);

        if (!projectPerms) {
            return NextResponse.json({ documents: [], projectName: '', clientName: '' });
        }

        return NextResponse.json({
            projectId,
            projectName: projectPerms.projectName,
            clientName: projectPerms.clientName,
            documents: projectPerms.documents,
            caseStudyMatch: projectPerms.caseStudyMatch
        });
    } catch (error) {
        console.error('Errore lettura documenti:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
