// ═══════════════════════════════════════════════════════════════════
// OperativaAside — colonna destra del tab Operativa.
// Estratto il 29/09/2026 (Refactor C, step C1.f) da:
//   app/admin/partner-projects/[id]/page.tsx (righe 883-1121)
//
// Contiene 4 sezioni collassabili:
//   - INTELLIGENCE: switch motore AI + azioni copia-contesto
//   - PERSONE / PARTI: form aggiunta + filtro lifecycle + card per parte
//   - DOCUMENTI & ATTI: upload form + lista download
//   - ATTIVITÀ RECENTI: mini-feed ultime 3 email + 2 documenti
//
// Props raggruppate in 3 oggetti (data, state, callbacks) per
// leggibilità su 20+ dipendenze.
// ═══════════════════════════════════════════════════════════════════

'use client';

import {
  Activity, ChevronDown, Download, FileText, Loader2, Phone,
  Sparkles, UploadCloud, UserPlus, Zap,
} from 'lucide-react';
import { LifecycleBadge } from '@/components/admin/LifecycleBadge';
import HeinrichPanel from '@/components/admin/HeinrichPanel';
import { ScoutingModal, type ScoutingData } from '@/components/admin/ScoutingModal';

type IntelligenceEngine = 'susanna' | 'chatgpt' | 'gemini' | 'onalpha';

type Partner = {
  id: number;
  name: string;
  partnerId: number | null;
  partnerName: string | null;
  lifecycleStage?: string | null;
};

type PartnerResult = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
};

type Document = {
  id: number;
  name: string;
  file_size: number;
  create_date: string;
};

type EmailLog = {
  id: number;
  subject: string;
  direction: 'ricevuta' | 'inviata';
  date: string;
};

type Note = { title: string; body: string; note_type: string };

type Props = {
  data: {
    partners: Partner[];
    documents: Document[];
    emails: EmailLog[];
    partnerScouting: Record<number, ScoutingData | null>;
    externalAiUrls: Record<IntelligenceEngine, string>;
  };
  state: {
    activeEngine: IntelligenceEngine;
    openSections: Record<string, boolean>;
    lifecycleFilter: 'all' | 'active' | 'degraded';
    showAddPart: boolean;
    partName: string;
    partEmail: string;
    partnerResults: PartnerResult[];
    selectedExistingPartnerId: number | null;
    savingPart: boolean;
    uploadFile: File | null;
    uploading: boolean;
    uploadError: string | null;
  };
  callbacks: {
    onToggleSection: (key: string) => void;
    onSelectEngine: (engine: IntelligenceEngine) => void;
    onCopyContext: () => void;
    onToggleAddPart: () => void;
    onAddPart: (e: React.FormEvent) => void;
    onPartNameChange: (v: string) => void;
    onPartEmailChange: (v: string) => void;
    onSelectExistingPartner: (p: PartnerResult) => void;
    onOpenRichPart: () => void;
    onLifecycleFilterChange: (f: 'all' | 'active' | 'degraded') => void;
    onStartLiveCall: (partnerId: number, partnerName: string) => void;
    onScoutingChanged: (partnerId: number, s: ScoutingData | null) => void;
    onUploadDocument: (e: React.FormEvent) => void;
    onUploadFileChange: (f: File | null) => void;
  };
};

export function OperativaAside({ data, state, callbacks }: Props) {
  return (
    <aside className="bg-[#f8fafc] flex flex-col h-full overflow-y-auto p-5 space-y-6">

      {/* INTELLIGENCE */}
      <section>
        <div
          onClick={() => callbacks.onToggleSection('intelligence')}
          className="flex items-center justify-between mb-2 border-b border-gray-200/60 pb-2 cursor-pointer select-none"
        >
          <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
            <Zap size={13} className="text-[#1a7fa8]" /> INTELLIGENCE
          </h2>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${state.openSections.intelligence ? '' : '-rotate-90'}`} />
        </div>
        {state.openSections.intelligence && (
          <>
            <div className="flex items-center gap-1 mb-3">
              {(['susanna', 'chatgpt', 'gemini', 'onalpha'] as IntelligenceEngine[]).map((engine) => (
                <button
                  key={engine}
                  onClick={() => callbacks.onSelectEngine(engine)}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer transition-colors ${
                    state.activeEngine === engine ? 'bg-[#0f172a] text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {engine === 'susanna' ? 'Susanna' : engine === 'chatgpt' ? 'ChatGPT' : engine === 'gemini' ? 'Gemini' : 'OnAlpha'}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              {[
                { label: '✦ Analizza Progetto' },
                { label: '✉ Riassumi Email' },
                { label: '�� Analizza Documenti' },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={callbacks.onCopyContext}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-white border border-gray-200/80 text-xs text-[#0f172a] hover:bg-gray-50 transition-colors cursor-pointer font-medium"
                >
                  <span>{action.label}</span>
                  <Sparkles size={12} className="text-amber-500" />
                </button>
              ))}

              {state.activeEngine !== 'susanna' && (
                <a
                  href={data.externalAiUrls[state.activeEngine]}
                  target="_blank"
                  rel="noreferrer"
                  onClick={callbacks.onCopyContext}
                  className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-[#1a7fa8] text-white text-xs font-semibold hover:bg-[#156688] transition-colors cursor-pointer"
                >
                  <span>
                    Apri {state.activeEngine === 'chatgpt' ? 'ChatGPT' : state.activeEngine === 'gemini' ? 'Gemini' : 'OnAlpha'} ↗
                  </span>
                </a>
              )}
            </div>
          </>
        )}
      </section>

      {/* PARTI */}
      <section className="border-t border-gray-200/60 pt-4">
        <div
          onClick={() => callbacks.onToggleSection('parti')}
          className="flex items-center justify-between mb-2.5 cursor-pointer select-none"
        >
          <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">Persone / Parti</h2>
          <button
            onClick={(ev) => { ev.stopPropagation(); callbacks.onToggleAddPart(); }}
            className="text-gray-600 hover:text-black cursor-pointer"
          >
            <UserPlus size={14} />
          </button>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${state.openSections.parti ? '' : '-rotate-90'}`} />
        </div>
        {state.openSections.parti && (
          <>
            {state.showAddPart && (
              <form onSubmit={callbacks.onAddPart} className="bg-white rounded p-3 mb-3 space-y-2 border border-gray-200">
                <div className="relative">
                  <input
                    required
                    placeholder="Nome *"
                    value={state.partName}
                    onChange={(e) => callbacks.onPartNameChange(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-gray-200 text-xs"
                  />
                  {state.partnerResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-36 overflow-y-auto">
                      {state.partnerResults.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => callbacks.onSelectExistingPartner(p)}
                          className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          <div className="font-medium text-gray-800">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={state.partEmail}
                  onChange={(e) => callbacks.onPartEmailChange(e.target.value)}
                  className="w-full px-2.5 py-1 rounded border border-gray-200 text-xs"
                />
                <button
                  type="submit"
                  disabled={state.savingPart}
                  className="w-full py-1 rounded bg-[#0f172a] text-white text-xs font-medium"
                >
                  Aggiungi
                </button>
                <button
                  type="button"
                  onClick={callbacks.onOpenRichPart}
                  className="w-full py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  ➕ Scheda completa (persona + azienda)
                </button>
              </form>
            )}

            <div className="mb-2 flex items-center gap-1">
              {(['all', 'active', 'degraded'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => callbacks.onLifecycleFilterChange(f)}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors ${
                    state.lifecycleFilter === f ? 'bg-[#0f172a] text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {f === 'all' ? 'Tutti' : f === 'active' ? 'Attivi' : 'Degradati'}
                </button>
              ))}
            </div>

            {data.partners.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nessuna parte collegata.</p>
            ) : (
              <div className="space-y-1.5">
                {data.partners
                  .filter((p) => {
                    if (state.lifecycleFilter === 'all') return true;
                    if (state.lifecycleFilter === 'active') return p.lifecycleStage !== 'degradato' && p.lifecycleStage !== 'chiuso';
                    return p.lifecycleStage === 'degradato';
                  })
                  .map((p) => (
                    <div key={p.id} className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-100">
                      <div className="flex items-center gap-1.5 font-semibold text-[#0f172a]">
                        <span>{p.partnerName || p.name}</span>
                        <LifecycleBadge stage={p.lifecycleStage ?? null} />
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        {p.partnerId && (
                          <>
                            <button
                              onClick={() => callbacks.onStartLiveCall(p.partnerId!, p.partnerName || p.name)}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                              title="Avvia Live Call"
                            >
                              <Phone size={12} />
                            </button>
                            <ScoutingModal
                              partnerId={p.partnerId}
                              partnerName={p.partnerName || p.name}
                              scouting={data.partnerScouting[p.partnerId] ?? null}
                              onChanged={(s) => callbacks.onScoutingChanged(p.partnerId!, s)}
                            />
                          </>
                        )}
                        <HeinrichPanel resModel="erpv6.tracking.relation" resId={p.id} compact />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* DOCUMENTI */}
      <section className="border-t border-gray-200/60 pt-4">
        <div
          onClick={() => callbacks.onToggleSection('documenti')}
          className="flex items-center justify-between mb-2.5 cursor-pointer select-none"
        >
          <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
            <FileText size={13} /> Documenti &amp; Atti
          </h2>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${state.openSections.documenti ? '' : '-rotate-90'}`} />
        </div>
        {state.openSections.documenti && (
          <>
            {data.documents.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-2">Nessun documento caricato.</p>
            ) : (
              <div className="space-y-1 mb-3">
                {data.documents.map((d) => (
                  <a
                    key={d.id}
                    href={`/api/admin/attachments/${d.id}/download`}
                    className="flex items-center justify-between p-1.5 rounded bg-white hover:bg-gray-100/70 border border-gray-100 text-xs text-gray-800 transition-colors"
                  >
                    <span className="truncate font-medium">{d.name}</span>
                    <Download size={12} className="text-gray-400 shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            )}

            <form onSubmit={callbacks.onUploadDocument} className="space-y-2">
              <input
                type="file"
                onChange={(e) => callbacks.onUploadFileChange(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-xs file:cursor-pointer"
              />
              {state.uploadError && (
                <p className="text-[11px] text-red-600">{state.uploadError}</p>
              )}
              <button
                type="submit"
                disabled={!state.uploadFile || state.uploading}
                className="w-full py-1.5 rounded bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {state.uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                {state.uploading ? 'Caricamento...' : 'Carica Documento'}
              </button>
            </form>
          </>
        )}
      </section>

      {/* ATTIVITÀ RECENTI */}
      <section className="border-t border-gray-200/60 pt-4">
        <div
          onClick={() => callbacks.onToggleSection('attivita')}
          className="flex items-center justify-between mb-2.5 cursor-pointer select-none"
        >
          <h2 className="text-[11px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
            <Activity size={13} className="text-[#1a7fa8]" /> Attività Recenti
          </h2>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${state.openSections.attivita ? '' : '-rotate-90'}`} />
        </div>
        {state.openSections.attivita && (
          <div className="space-y-2">
            {data.emails.slice(0, 3).map((e) => (
              <div key={`act-${e.id}`} className="text-[11px] text-gray-500 flex items-start gap-2">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${e.direction === 'inviata' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                <span className="truncate">
                  {e.direction === 'inviata' ? 'Email inviata:' : 'Email ricevuta:'} {e.subject}
                </span>
              </div>
            ))}
            {data.documents.slice(0, 2).map((d) => (
              <div key={`act-doc-${d.id}`} className="text-[11px] text-gray-500 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate">Documento caricato: {d.name}</span>
              </div>
            ))}
            {data.emails.length === 0 && data.documents.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nessuna attività recente.</p>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
