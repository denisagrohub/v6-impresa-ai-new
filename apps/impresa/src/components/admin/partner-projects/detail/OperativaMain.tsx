// ═══════════════════════════════════════════════════════════════════
// OperativaMain — colonna sinistra del tab Operativa.
// Estratto il 29/09/2026 (Refactor C, step C1.e) da:
//   app/admin/partner-projects/[id]/page.tsx (righe 855-1076)
//
// Contiene:
//   - Header contestuale (persona/target selezionato)
//   - Workbench (flusso email + azioni)  O  Lavagna strategica (note)
//   - Progetti operativi (childProjects)
//   - Deal collegato (cards)
//
// Le dipendenze sono raggruppate in 3 oggetti (data/email/callbacks)
// per evitare 25 prop-drilling piatte.
// ═══════════════════════════════════════════════════════════════════

'use client';

import {
  ChevronDown, ChevronUp, FileText, Loader2, Phone, Send,
} from 'lucide-react';
import DOMPurify from 'dompurify';
// Componenti laterali: pannelli AI/note incastonati nelle card delle parti
import { WorkAreaPanel } from '@/components/admin/WorkAreaPanel';
import { useState } from 'react';
import { ChildProjectsList, type ChildProject } from '@/components/projects/ChildProjectsList';
import { DealCard, type DealCollegato } from '@/components/deals/DealCard';
import NotesBoard from '@/components/admin/NotesBoard';
import {
  analyzeSentEmailContent,
} from '@/lib/partner-projects/email-analysis';
import type { OperativaContext } from '@/components/admin/CopertinaPage';

type EmailLog = {
  id: number;
  subject: string;
  senderEmail: string;
  recipientEmails: string;
  ccEmails: string;
  matchStatus: string;
  direction: 'ricevuta' | 'inviata';
  date: string;
  relationId?: number | null;
  recipientRelationId?: number | null;
  // 02/10/2026 (C2-rd-prog): letto per-utente via read.state
  is_read?: boolean;
  read_at?: string | null;
};

type Note = { title: string; body: string; note_type: string };

type Props = {
  projectId: number;
  project: { id: number; name: string } | null;
  emails: EmailLog[];               // già filtrate dal page (contesto)
  childProjects: ChildProject[];
  deals: DealCollegato[];
  seenAt?: string | null;  // 02/10/2026: non più usato, backward compat
  operativeContext: OperativaContext | null;
  viewMode: 'workbench' | 'lavagna';
  targets: { id: number; contattoName: string | null }[];
  emailState: {
    openId: number | null;
    bodies: Record<number, string | null>;
    loadingId: number | null;
  };
  callbacks: {
    onToggleEmail: (id: number) => void;
    onOpenEmailComposer: () => void;
    onStartLiveCall: (partnerId: number, partnerName: string) => void;
    onOpenBrief: () => void;
    onOpenDebrief: () => void;
    onSendNote: (note: Note) => Promise<{ ok: boolean; text: string }>;
  };
};

export function OperativaMain({
  projectId, project, emails, childProjects, deals, seenAt,
  operativeContext, viewMode, targets,
  emailState, callbacks,
}: Props) {
  // 02/10/2026 (C4b): collassabile per la sezione "Progetti operativi"
  const [childProjectsOpen, setChildProjectsOpen] = useState(true);

  return (
    <main className="flex flex-col min-w-0 bg-white p-6 border-r border-[#e2e8f0]">

      {/* HEADER CONTESTUALE (se contesto != progetto) */}
      {operativeContext && operativeContext.type !== 'project' && (
        <div className="mb-5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                Contesto
              </div>
              <h2 className="text-lg font-bold text-[#0f172a]">{operativeContext.label}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {operativeContext.type === 'person'
                  ? 'Persona · parte del progetto'
                  : 'Target · in pipeline'}
              </p>
              {operativeContext.type === 'target' && (() => {
                const t = targets.find((x) => x.id === operativeContext.id);
                if (!t?.contattoName) return null;
                return (
                  <p className="text-xs text-sky-700 mt-1 flex items-center gap-1">
                    <span className="font-semibold">Referente:</span>
                    {t.contattoName}
                  </p>
                );
              })()}
            </div>
            <div className="flex items-center gap-1.5">
              {operativeContext.partnerId && (
                <button
                  onClick={() => callbacks.onStartLiveCall(
                    operativeContext.partnerId!, operativeContext.label)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700"
                >
                  <Phone size={11} /> Call
                </button>
              )}
              <button
                onClick={callbacks.onOpenEmailComposer}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0f172a] text-white text-[11px] font-semibold hover:bg-[#1e293b]"
              >
                <Send size={11} /> Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 02/10/2026 (C4b): Progetti operativi in alto (era in fondo),
          collassabile. Default aperto. */}
      {childProjects.length > 0 && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white">
          <button
            onClick={() => setChildProjectsOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform shrink-0 ${childProjectsOpen ? '' : '-rotate-90'}`}
            />
            <h2 className="text-base font-semibold text-[#0f172a]">Progetti operativi</h2>
            <span className="text-xs text-gray-400 tabular-nums">({childProjects.length})</span>
          </button>
          {childProjectsOpen && (
            <div className="px-5 pb-5">
              <ChildProjectsList projects={childProjects} />
            </div>
          )}
        </section>
      )}

      {viewMode === 'workbench' ? (
        <section className="space-y-6">
          <WorkAreaPanel projectId={projectId} />

          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1.5">
              <FileText size={13} /> Comunicazioni &amp; Flusso Email
            </h2>
            <button
              onClick={callbacks.onOpenEmailComposer}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] transition-colors cursor-pointer"
            >
              <Send size={12} />
              Scrivi Email
            </button>
          </div>

          {emails.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Nessuna email {operativeContext && 'id' in operativeContext ? 'per questo contesto' : 'registrata'}.
            </p>
          ) : (
            <div className="space-y-1">
              {emails.map((e) => {
                const isOut = e.direction === 'inviata';
                // 02/10/2026 (C2-rd-prog): isNew per-utente via read.state
                // (solo ricevute; le inviate non hanno "da leggere")
                const isNew = !isOut && !e.is_read;
                const bodyText = emailState.bodies[e.id] || '';
                const sentAnalysis = isOut ? analyzeSentEmailContent(e.subject, bodyText) : null;

                return (
                  <div
                    key={e.id}
                    className={`border-b border-gray-50 last:border-0 py-2 rounded ${
                      isNew ? 'bg-amber-50 border border-amber-200' : ''
                    }`}
                  >
                    <button
                      onClick={() => callbacks.onToggleEmail(e.id)}
                      className="w-full flex items-start justify-between text-left hover:bg-[#f8fafc] p-1.5 rounded transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold ${isOut ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {isOut ? '📤 OUT' : '📥 IN'}
                          </span>
                          <span className="text-xs font-medium text-[#0f172a]">{e.subject}</span>
                          {isNew && (
                            <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              🆕 NUOVA
                            </span>
                          )}
                          {isOut && sentAnalysis && (
                            <div className="flex items-center gap-1.5 ml-1">
                              {sentAnalysis.needsSignature && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  ✍️ In Attesa di Firma
                                </span>
                              )}
                              {sentAnalysis.needsDocuments && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                                  📄 In Attesa Documenti
                                </span>
                              )}
                              {sentAnalysis.needsReply && !sentAnalysis.needsSignature && !sentAnalysis.needsDocuments && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                                  ⏳ In Attesa Riscontro
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {isOut ? 'a: ' + e.recipientEmails : 'da: ' + e.senderEmail}
                            {' · '}
                            {e.date ? new Date(e.date).toLocaleString('it-IT') : ''}
                          </div>
                        </div>
                      </div>
                      {emailState.openId === e.id
                        ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
                        : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                    </button>

                    {emailState.openId === e.id && (
                      <div className="mt-2 pl-6 pr-2 pb-2 space-y-2">
                        {isOut && sentAnalysis && (sentAnalysis.needsSignature || sentAnalysis.needsDocuments) && (
                          <div className="p-2.5 rounded-md bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900">
                            <div className="flex items-center gap-2">
                              <span className="text-base">📌</span>
                              <span>
                                <strong>Azione Richiesta Inviata:</strong> In questa email hai richiesto
                                {sentAnalysis.needsSignature && sentAnalysis.needsDocuments
                                  ? ' la firma e l\u2019invio di documenti.'
                                  : sentAnalysis.needsSignature
                                    ? ' la firma del documento.'
                                    : ' l\u2019invio di documenti.'}
                              </span>
                            </div>
                          </div>
                        )}

                        {emailState.loadingId === e.id ? (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        ) : emailState.bodies[e.id] ? (
                          <div
                            className="prose prose-xs max-w-none text-gray-600 text-[12px] bg-[#f8fafc] p-3 rounded"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(emailState.bodies[e.id] as string),
                            }}
                          />
                        ) : (
                          <p className="text-xs text-gray-400">Nessun contenuto disponibile.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="h-full flex flex-col">
          <div className="border-b border-gray-100 pb-3 mb-4 flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
              Lavagna Strategica Progetto
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={callbacks.onOpenBrief}
                className="flex items-center gap-1.5 px-3 py-1 rounded border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                📋 Compila Brief
              </button>
              <button
                onClick={callbacks.onOpenDebrief}
                className="flex items-center gap-1.5 px-3 py-1 rounded border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                🔍 Compila Debrief
              </button>
            </div>
          </div>

          {project && (
            <NotesBoard
              resModel="erpv6.tracking.relation"
              resId={project.id}
              onSendEmail={callbacks.onSendNote}
            />
          )}
        </section>
      )}

      {deals.length > 0 && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold mb-3">Deal collegato</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
