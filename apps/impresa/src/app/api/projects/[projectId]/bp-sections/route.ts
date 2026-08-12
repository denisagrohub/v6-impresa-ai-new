// src/app/api/projects/[projectId]/bp-sections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const { projectId } = params;

        // Carica le sezioni dalla cartella del progetto
        const sectionsPath = path.join(
            process.cwd(),
            'src/data/projects',
            projectId,
            'sections.json'
        );

        if (!fs.existsSync(sectionsPath)) {
            // Fallback: genera sezioni demo
            return NextResponse.json({
                sections: [
                    {
                        id: 1,
                        title: "Executive Summary",
                        html: `
              <h3>Problema</h3>
              <p>Il cliente necessita di strutturazione finanziaria per ottenere finanziamenti bancari.</p>
              
              <h3>Soluzione</h3>
              <p>Business Plan completo con modello finanziario a 5 anni e pitch deck per investitori.</p>
              
              <h3>Risultati Attesi</h3>
              <ul>
                <li>Finanziamento bancario: €500.000</li>
                <li>Break-even: Mese 18</li>
                <li>ROI anno 3: 45%</li>
              </ul>
            `,
                        annotations: [
                            "Enfasi sul ROI per cliente tipo D (Dominante)",
                            "Preparare scenario worst-case per cliente tipo C (Coscienzioso)"
                        ]
                    },
                    {
                        id: 2,
                        title: "Analisi di Mercato",
                        html: `
              <h3>Dimensione Mercato (TAM)</h3>
              <p>€2.5 miliardi (mercato italiano)</p>
              
              <h3>Target (SAM)</h3>
              <p>€450 milioni (PMI settore tech)</p>
              
              <h3>Competitor</h3>
              <table>
                <tr><th>Competitor</th><th>Market Share</th><th>Pricing</th></tr>
                <tr><td>Competitor A</td><td>25%</td><td>€3.000</td></tr>
                <tr><td>Competitor B</td><td>15%</td><td>€2.500</td></tr>
              </table>
            `,
                        annotations: []
                    },
                    {
                        id: 3,
                        title: "Modello Finanziario",
                        html: `
              <h3>Proiezioni 5 Anni</h3>
              <table>
                <tr><th>Anno</th><th>Ricavi</th><th>EBITDA</th><th>Margine</th></tr>
                <tr><td>Anno 1</td><td>€450K</td><td>€90K</td><td>20%</td></tr>
                <tr><td>Anno 2</td><td>€680K</td><td>€170K</td><td>25%</td></tr>
                <tr><td>Anno 3</td><td>€950K</td><td>€285K</td><td>30%</td></tr>
              </table>
              
              <h3>Use of Funds</h3>
              <ul>
                <li>Sviluppo prodotto: 40%</li>
                <li>Marketing: 30%</li>
                <li>Team: 20%</li>
                <li>Operazioni: 10%</li>
              </ul>
            `,
                        annotations: [
                            "Se cliente chiede dettagli su burn rate, mostrare scenario worst-case"
                        ]
                    }
                ]
            });
        }

        const sections = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'));
        return NextResponse.json({ sections });
    } catch (error) {
        console.error('Errore caricamento sezioni BP:', error);
        return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
    }
}
