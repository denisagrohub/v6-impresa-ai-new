'use client';
import { useState } from 'react';
import { 
  FolderOpen, FileText, ClipboardList, Brain, 
  MessageSquare, Phone, Users, BarChart3,
  File, Download, Eye, Loader2
} from 'lucide-react';
import { Card } from '@erpv6/ui';
import { Badge } from '@erpv6/ui';
import { Button } from '@erpv6/ui';

interface ToolboxProps {
  projectId: string;
  consultantId: string;
}

export function ConsultantToolbox({ projectId, consultantId }: ToolboxProps) {
  const [activeTab, setActiveTab] = useState<'documents' | 'interview' | 'call-insights' | 'notes'>('documents');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  // DATI MOCK (senza chiamate API)
  const documents = [
    { id: 1, name: 'Memorandum per Investitori Rev3.docx', type: 'docx', size: '2.4 MB', date: '2026-07-20' },
    { id: 2, name: 'Financial Model Anno 1.xlsx', type: 'xlsx', size: '1.8 MB', date: '2026-07-19' },
    { id: 3, name: 'Perizia CTU 2022.pdf', type: 'pdf', size: '4.2 MB', date: '2026-07-15' },
    { id: 4, name: 'Contratto Hera Energia.pdf', type: 'pdf', size: '1.2 MB', date: '2026-07-10' },
  ];

  const interviewData = {
    companyName: 'Fattoria Ai Tosi Mati',
    sector: 'Agricolo / Zootecnico',
    revenue: '€1.013.200',
    employees: '5',
    founders: 'Denis e Martina',
    objectives: 'Raccolta capitali €800.000',
  };

  const callInsights = {
    disc: { primary: 'D', secondary: 'C' },
    pl: ['PL-02: Decisione mentalmente presa', 'PL-05: Burn rate preoccupazione'],
    objections: ['Timing: preoccupazione sul momento dell\'investimento'],
    suggestions: ['Usa tono diretto e dati concreti', 'Rassicura con scenari conservativi'],
  };

  const saveNotes = () => {
    if (notes.trim()) {
      localStorage.setItem(`toolbox_notes_${projectId}`, notes);
      alert('✅ Note salvate!');
    }
  };

  const loadSavedNotes = () => {
    const saved = localStorage.getItem(`toolbox_notes_${projectId}`);
    if (saved) setNotes(saved);
  };

  // Carica note salvate all'avvio
  useState(() => {
    loadSavedNotes();
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-4">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Brain size={20} className="text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-[#1a2744] text-sm">🛠️ Cassetta degli Attrezzi</h3>
              <p className="text-xs text-gray-500">Tutto ciò che serve</p>
            </div>
          </div>
          <Badge variant="primary" className="bg-orange-500 text-white text-xs">
            {documents.length} doc
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50/50 px-2 overflow-x-auto">
        {[
          { id: 'documents', label: '📁', title: 'Documenti' },
          { id: 'interview', label: '📋', title: 'Intervista' },
          { id: 'call-insights', label: '🧠', title: 'Call Insights' },
          { id: 'notes', label: '📝', title: 'Note' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            title={tab.title}
          >
            {tab.label}
            <span className="text-xs hidden sm:inline">{tab.title}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 max-h-[500px] overflow-y-auto">
        {activeTab === 'documents' && (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-blue-600 flex-shrink-0" />
                  <span className="truncate text-xs">{doc.name}</span>
                </div>
                <button className="p-1 rounded hover:bg-white" title="Scarica">
                  <Download size={14} className="text-gray-500" />
                </button>
              </div>
            ))}
            <div className="text-xs text-gray-400 text-center mt-2">
              💡 I documenti reali appariranno quando collegati a Odoo
            </div>
          </div>
        )}

        {activeTab === 'interview' && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-500 text-xs">Azienda:</span>
              <span className="font-medium text-xs truncate">{interviewData.companyName}</span>
              <span className="text-gray-500 text-xs">Settore:</span>
              <span className="font-medium text-xs truncate">{interviewData.sector}</span>
              <span className="text-gray-500 text-xs">Fatturato:</span>
              <span className="font-medium text-xs">{interviewData.revenue}</span>
              <span className="text-gray-500 text-xs">Dipendenti:</span>
              <span className="font-medium text-xs">{interviewData.employees}</span>
              <span className="text-gray-500 text-xs">Fondatori:</span>
              <span className="font-medium text-xs">{interviewData.founders}</span>
              <span className="text-gray-500 text-xs col-span-2">Obiettivi:</span>
              <span className="font-medium text-xs col-span-2">{interviewData.objectives}</span>
            </div>
            <button className="w-full py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              📋 Vedi Intervista Completa
            </button>
          </div>
        )}

        {activeTab === 'call-insights' && (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <span className="font-bold text-xs">🧠 Profilo DISC:</span>
              <Badge variant="primary" className="bg-purple-600 text-white text-xs ml-2">
                {callInsights.disc.primary} / {callInsights.disc.secondary}
              </Badge>
              <p className="text-xs text-gray-600 mt-1">→ Usa tono diretto e dati concreti</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="font-bold text-xs">⚠️ Obiezioni:</span>
              <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
                {callInsights.objections.map((o: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">• {o}</li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <span className="font-bold text-xs">💡 Suggerimenti:</span>
              <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
                {callInsights.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">→ {s}</li>
                ))}
              </ul>
            </div>
            <button className="w-full py-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
              🎙️ Vedi Report Call Completo
            </button>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Scrivi le tue note personali sul progetto..."
              rows={4}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 text-sm resize-none"
            />
            <Button 
              variant="primary" 
              size="sm" 
              className="w-full text-xs"
              onClick={saveNotes}
            >
              💾 Salva Note
            </Button>
            <div className="text-xs text-gray-400 text-center">
              Le note sono salvate nel tuo browser
            </div>
          </div>
        )}
      </div>

      {/* Footer: Accesso Rapido */}
      <div className="p-2 border-t border-gray-200 bg-gray-50/50 flex gap-1 flex-wrap">
        <button className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs hover:bg-gray-50">
          <File size={12} /> Documenti
        </button>
        <button className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs hover:bg-gray-50">
          <Phone size={12} /> Call
        </button>
        <button className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">
          <Brain size={12} /> AI Assist
        </button>
      </div>
    </div>
  );
}
