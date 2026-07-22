import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CASE_STUDIES_PATH = path.join(process.cwd(), 'src/data/case-studies.json');
const PERMISSIONS_PATH = path.join(process.cwd(), 'src/data/document-permissions.json');

export async function POST(request: NextRequest) {
    try {
        const { projectId, settore, livello, brand } = await request.json();

        if (!fs.existsSync(CASE_STUDIES_PATH)) {
            return NextResponse.json({ caseStudy: null, matchType: 'none' });
        }

        const csData = JSON.parse(fs.readFileSync(CASE_STUDIES_PATH, 'utf-8'));
        const caseStudies = csData.caseStudies || [];

        // 1. Matching diretto da document-permissions
        if (fs.existsSync(PERMISSIONS_PATH)) {
            const permsData = JSON.parse(fs.readFileSync(PERMISSIONS_PATH, 'utf-8'));
            const projectPerms = permsData.permissions.find((p: any) => p.projectId === projectId);

            if (projectPerms?.caseStudyMatch) {
                const matched = caseStudies.find((cs: any) => cs.id === projectPerms.caseStudyMatch);
                if (matched) {
                    return NextResponse.json({ caseStudy: matched, matchType: 'direct' });
                }
            }
        }

        // 2. Matching per settore + livello + brand
        const matched = caseStudies.find((cs: any) =>
            cs.settore === settore && cs.livello === livello && cs.brand === brand
        );
        if (matched) {
            return NextResponse.json({ caseStudy: matched, matchType: 'full' });
        }

        // 3. Matching per settore + livello
        const sectorLevelMatch = caseStudies.find((cs: any) =>
            cs.settore === settore && cs.livello === livello
        );
        if (sectorLevelMatch) {
            return NextResponse.json({ caseStudy: sectorLevelMatch, matchType: 'sector+level' });
        }

        // 4. Matching solo per settore
        const sectorMatch = caseStudies.find((cs: any) => cs.settore === settore);
        if (sectorMatch) {
            return NextResponse.json({ caseStudy: sectorMatch, matchType: 'sector' });
        }

        // 5. Fallback
        return NextResponse.json({ caseStudy: caseStudies[0] || null, matchType: 'fallback' });
    } catch (error) {
        console.error('Errore matching caso studio:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
