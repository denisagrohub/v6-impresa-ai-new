"use client";
import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react';

interface BPViewerProps {
    projectId: string;
    projectName: string;
    clientName: string;
    onClose: () => void;
}

interface BPSection {
    id: number;
    title: string;
    content: string;
    notes?: string[];
}

export default function BPViewer({ projectId, projectName, clientName, onClose }: BPViewerProps) {
    const [currentSection, setCurrentSection] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Dati demo della bozza BP (in produzione verranno da Odoo/JSON)
    const sections: BPSection[] = [
        {
            id: 1,
            title: "Executive Summary",
            content: `
        <h3>Problema</h3>
        <p>Il cliente necessita di strutturazione finanziaria per ottenere finanziamenti bancari e supportare la crescita dell'azienda.</p>
        
        <h3>Soluzione</h3>
        <p>Business Plan completo con modello finanziario a 5 anni, analisi di mercato dettagliata e pitch deck per investitori.</p>
        
        <h3>Risultati Attesi</h3>
        <ul>
          <li>Finanziamento bancario: €500.000</li>
          <li>Break-even: Mese 18</li>
          <li>ROI anno 3: 45%</li>
        </ul>
      `,
            notes: [
                "Enfasi sul ROI per cliente tipo D (Dominante)",
                "Preparare scenario worst-case per cliente tipo C (Coscienzioso)"
            ]
        },
        {
            id: 2,
            title: "Analisi di Mercato",
            content: `
        <h3>Dimensione Mercato (TAM)</h3>
        <p>€2.5 miliardi (mercato italiano)</p>
        
        <h3>Target (SAM)</h3>
        <p>€450 milioni (PMI settore tech)</p>
        
        <h3>Competitor</h3>
        <table>
          <tr><th>Competitor</th><th>Market Share</th><th>Pricing</th></tr>
          <tr><td>Competitor A</td><td>25%</td><td>€3.000</td></tr>
          <tr><td>Competitor B</td><td>15%</td><td>€2.500</td></tr>
          <tr><td>Noi</td><td>Target 5%</td><td>€2.800</td></tr>
        </table>
      `,
            notes: []
        },
        {
            id: 3,
            title: "Modello Finanziario",
            content: `
        <h3>Proiezioni 5 Anni</h3>
        <table>
          <tr><th>Anno</th><th>Ricavi</th><th>EBITDA</th><th>Margine</th></tr>
          <tr><td>Anno 1</td><td>€450K</td><td>€90K</td><td>20%</td></tr>
          <tr><td>Anno 2</td><td>€680K</td><td>€170K</td><td>25%</td></tr>
          <tr><td>Anno 3</td><td>€950K</td><td>€285K</td><td>30%</td></tr>
          <tr><td>Anno 4</td><td>€1.2M</td><td>€420K</td><td>35%</td></tr>
          <tr><td>Anno 5</td><td>€1.5M</td><td>€600K</td><td>40%</td></tr>
        </table>
        
        <h3>Use of Funds</h3>
        <ul>
          <li>Sviluppo prodotto: 40%</li>
          <li>Marketing: 30%</li>
          <li>Team: 20%</li>
          <li>Operazioni: 10%</li>
        </ul>
      `,
            notes: [
                "Se cliente chiede dettagli su burn rate, mostrare scenario worst-case"
            ]
        },
        {
            id: 4,
            title: "Strategia Go-to-Market",
            content: `
        <h3>Canali di Acquisizione</h3>
        <ul>
          <li><strong>Diretto:</strong> Sales team interno (60% ricavi)</li>
          <li><strong>Partner:</strong> Canale indiretto (25% ricavi)</li>
          <li><strong>Digitale:</strong> Marketing online (15% ricavi)</li>
        </ul>
        
        <h3>Pricing Strategy</h3>
        <p>Tiered pricing basato su dimensioni azienda e funzionalità richieste.</p>
        
        <h3>Milestone Chiave</h3>
        <ul>
          <li>Q1: Lancio MVP</li>
          <li>Q2: 50 clienti paganti</li>
          <li>Q3: Espansione internazionale</li>
          <li>Q4: Break-even raggiunto</li>
        </ul>
      `,
            notes: []
        },
        {
            id: 5,
            title: "Team e Governance",
            content: `
        <h3>Founding Team</h3>
        <ul>
          <li><strong>CEO:</strong> 10+ anni esperienza settore</li>
          <li><strong>CTO:</strong> Ex Google, esperto AI/ML</li>
          <li><strong>COO:</strong> Background operations scaling</li>
        </ul>
        
        <h3>Advisory Board</h3>
        <p>3 advisor con esperienza in fundraising e scaling internazionale.</p>
        
        <h3>Piano Assunzioni</h3>
        <table>
          <tr><th>Anno</th><th>Team Size</th><th>Ruolo Chiave</th></tr>
          <tr><td>Anno 1</td><td>5</td><td>Sales Manager</td></tr>
          <tr><td>Anno 2</td><td>12</td><td>Marketing Director</td></tr>
          <tr><td>Anno 3</td><td>25</td><td>Country Manager EU</td></tr>
        </table>
      `,
            notes: []
        }
    ];

    const nextSection = () => {
        if (currentSection < sections.length - 1) {
            setCurrentSection(currentSection + 1);
        }
    };

    const prevSection = () => {
        if (currentSection > 0) {
            setCurrentSection(currentSection - 1);
        }
    };

    const currentContent = sections[currentSection];

    return (
        <div className={`fixed inset-0 bg-white z-[60] flex flex-col ${isFullscreen ? '' : 'inset-4 rounded-2xl shadow-2xl'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1a2744] to-[#0f3460] text-white px-6 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">{projectName}</h2>
                    <p className="text-sm text-gray-300">Bozza Business Plan — {clientName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={isFullscreen ? 'Esci da fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Chiudi presentazione"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Navigation Bar */}
            <div className="bg-gray-100 px-6 py-3 flex items-center justify-between border-b">
                <button
                    onClick={prevSection}
                    disabled={currentSection === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft size={18} />
                    <span className="text-sm font-medium">Precedente</span>
                </button>

                <div className="flex items-center gap-2">
                    {sections.map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => setCurrentSection(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${idx === currentSection
                                    ? 'bg-[#1a2744] text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>

                <button
                    onClick={nextSection}
                    disabled={currentSection === sections.length - 1}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <span className="text-sm font-medium">Successiva</span>
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-12">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-bold text-[#1a2744] mb-8">
                        {currentContent.title}
                    </h1>

                    <div
                        className="prose prose-lg max-w-none text-gray-700"
                        dangerouslySetInnerHTML={{ __html: currentContent.content }}
                    />

                    {/* Notes per il consulente (visibili solo a lui) */}
                    {currentContent.notes && currentContent.notes.length > 0 && (
                        <div className="mt-12 p-6 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
                            <h3 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-2">
                                💡 Note per il Consulente
                            </h3>
                            <ul className="space-y-2">
                                {currentContent.notes.map((note, idx) => (
                                    <li key={idx} className="text-sm text-orange-800 flex items-start gap-2">
                                        <span className="text-orange-500 mt-0.5">•</span>
                                        <span>{note}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-100 px-6 py-3 border-t flex items-center justify-between text-sm text-gray-600">
                <span>Sezione {currentSection + 1} di {sections.length}</span>
                <span className="font-medium">{currentContent.title}</span>
            </div>
        </div>
    );
}
